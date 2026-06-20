import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import type { AppState, FuneralInput, GraveProject, ScanProgress } from '../src/shared/types';
import { PROJECT_MARKERS } from '../src/shared/constants';
import { analyzeProject, containingRoot, discoverProjectPaths, ScanCancelledError } from './scanner';
import { LocalStore } from './store';

let mainWindow: BrowserWindow | null = null;
let store: LocalStore;
let activeScan: AbortController | null = null;

function createWindow() {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#111612',
    titleBarStyle: 'hiddenInset',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void mainWindow.loadURL(devUrl);
  else void mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
}

function event(project: GraveProject, type: AppState['events'][number]['type'], details?: string) {
  return {
    id: randomUUID(),
    projectId: project.id,
    projectName: project.name,
    type,
    at: new Date().toISOString(),
    details,
  };
}

function projectById(state: AppState, id: string): GraveProject {
  const project = state.projects.find((item) => item.id === id);
  if (!project) throw new Error('项目不存在或已被移除。');
  return project;
}

function registerIpc() {
  ipcMain.handle('state:get', () => store.get());

  ipcMain.handle('settings:update', async (_event, settings: AppState['settings']) => {
    if (!Number.isInteger(settings.sleepAfterDays) || settings.sleepAfterDays < 1 || settings.sleepAfterDays > 3650) {
      throw new Error('沉睡阈值必须在 1 到 3650 天之间。');
    }
    if (!['zh-CN', 'en-US'].includes(settings.language) || !['night', 'day'].includes(settings.theme)) throw new Error('界面设置无效。');
    return store.update((state) => { state.settings = settings; });
  });

  ipcMain.handle('roots:select', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择允许 Project Graveyard 扫描的目录',
      buttonLabel: '允许扫描这些目录',
      properties: ['openDirectory', 'multiSelections'],
    });
    if (result.canceled) return store.get();
    return store.update((state) => {
      state.roots = [...new Set([...state.roots, ...result.filePaths.map((item) => path.resolve(item))])];
    });
  });

  ipcMain.handle('roots:remove', async (_event, root: string) => store.update((state) => {
    state.roots = state.roots.filter((item) => item !== root);
    state.projects = state.projects.filter((project) => project.rootPath !== root);
  }));

  ipcMain.handle('project-source:select', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择一个项目文件夹',
      buttonLabel: '添加这个项目',
      properties: ['openDirectory'],
    });
    if (result.canceled) return store.get();
    const projectPath = path.resolve(result.filePaths[0]);
    const entries = new Set(await fs.readdir(projectPath));
    if (!PROJECT_MARKERS.some((marker) => entries.has(marker))) {
      throw new Error('所选目录没有找到支持的项目标志文件。请选择项目根目录。');
    }
    return store.update((state) => {
      state.projectPaths = [...new Set([...state.projectPaths, projectPath])];
    });
  });

  ipcMain.handle('project-source:remove', async (_event, projectPath: string) => store.update((state) => {
    state.projectPaths = state.projectPaths.filter((item) => item !== projectPath);
    state.projects = state.projects.filter((project) => project.rootPath !== projectPath);
  }));

  ipcMain.handle('scan:start', async (ipcEvent) => {
    if (activeScan) throw new Error('已有扫描正在进行。');
    const stateBefore = store.get();
    if (stateBefore.roots.length === 0 && stateBefore.projectPaths.length === 0) throw new Error('请先添加扫描文件夹或单个项目。');
    const controller = new AbortController();
    activeScan = controller;
    let errors = 0;
    const send = (progress: ScanProgress) => ipcEvent.sender.send('scan:progress', progress);

    try {
      const discovered = stateBefore.roots.length ? await discoverProjectPaths(stateBefore.roots, controller.signal, send) : [];
      const paths = [...new Set([...discovered, ...stateBefore.projectPaths])];
      const scanned: GraveProject[] = [];
      for (const [index, projectPath] of paths.entries()) {
        if (controller.signal.aborted) throw new ScanCancelledError();
        try {
          scanned.push(await analyzeProject(
            projectPath,
            stateBefore.projectPaths.includes(projectPath) ? projectPath : containingRoot(projectPath, stateBefore.roots),
            stateBefore.settings.sleepAfterDays,
            controller.signal,
          ));
        } catch (error) {
          if (error instanceof ScanCancelledError) throw error;
          errors += 1;
        }
        send({ phase: 'analyzing', currentPath: projectPath, found: paths.length, analyzed: index + 1, errors });
      }

      const next = await store.update((state) => {
        const oldById = new Map(state.projects.map((project) => [project.id, project]));
        const retainedOutsideRoots = state.projects.filter((project) => !state.roots.includes(project.rootPath) && !state.projectPaths.includes(project.rootPath));
        state.projects = [
          ...retainedOutsideRoots,
          ...scanned.map((project) => {
            const old = oldById.get(project.id);
            if (!old) {
              state.events.push(event(project, 'discovered'));
              return project;
            }
            if (old.status === 'dead' && old.death) return { ...project, status: 'dead' as const, death: old.death };
            return project;
          }),
        ];
        // Projects missing from a current scan are removed from the live index, but history remains.
      });
      send({ phase: 'complete', currentPath: '', found: scanned.length, analyzed: scanned.length, errors });
      return next;
    } catch (error) {
      if (error instanceof ScanCancelledError) {
        send({ phase: 'cancelled', currentPath: '', found: 0, analyzed: 0, errors });
        return store.get();
      }
      throw error;
    } finally {
      activeScan = null;
    }
  });

  ipcMain.handle('scan:cancel', () => {
    activeScan?.abort();
    return Boolean(activeScan);
  });

  ipcMain.handle('project:funeral', async (_event, input: FuneralInput) => {
    const date = new Date(input.date.length === 10 ? `${input.date}T12:00:00` : input.date);
    if (Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 60_000) throw new Error('死亡时间无效。');
    if (!input.cause.trim()) throw new Error('请选择或填写死因。');
    return store.update((state) => {
      const project = projectById(state, input.projectId);
      if (project.status !== 'sleeping') throw new Error('只有沉睡项目可以举行葬礼。');
      if (date.getTime() < new Date(project.bornAt).getTime()) throw new Error('死亡日期不能早于出生日期。');
      if (date.getTime() < new Date(project.lastActiveAt).getTime()) throw new Error('死亡时间不能早于最后活动时间。');
      project.status = 'dead';
      project.death = { date: date.toISOString(), cause: input.cause.trim(), epitaph: input.epitaph.trim() };
      state.events.push(event(project, 'funeral', input.cause.trim()));
    });
  });

  ipcMain.handle('project:revive', async (_event, projectId: string) => {
    const state = store.get();
    const project = projectById(state, projectId);
    await fs.access(project.path);
    const next = await store.update((draft) => {
      const target = projectById(draft, projectId);
      if (target.status !== 'dead') throw new Error('只有死亡项目可以复活。');
      target.status = 'alive';
      delete target.death;
      draft.events.push(event(target, 'revived'));
    });
    const openError = await shell.openPath(project.path);
    if (openError) throw new Error(`项目已复活，但无法打开目录：${openError}`);
    return next;
  });

  ipcMain.handle('project:open', async (_event, projectId: string) => {
    const project = projectById(store.get(), projectId);
    const error = await shell.openPath(project.path);
    if (error) throw new Error(error);
  });

  ipcMain.handle('project:archive', async (_event, projectId: string) => {
    const project = projectById(store.get(), projectId);
    const selected = await dialog.showOpenDialog(mainWindow!, {
      title: '选择归档目录',
      buttonLabel: '选择此归档目录',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (selected.canceled) return store.get();
    const archiveRoot = path.resolve(selected.filePaths[0]);
    const source = path.resolve(project.path);
    if (archiveRoot === source || archiveRoot.startsWith(`${source}${path.sep}`)) throw new Error('归档目录不能位于项目内部。');
    const destination = path.join(archiveRoot, path.basename(source));
    try {
      await fs.access(destination);
      throw new Error(`目标已存在：${destination}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const confirm = await dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      title: '确认移动项目目录',
      message: `将整个项目目录移动到归档位置？`,
      detail: `${source}\n\n移动到\n${destination}\n\n这是文件操作。跨磁盘移动时，原目录只会进入系统回收站。`,
      buttons: ['取消', '确认移动目录'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (confirm.response !== 1) return store.get();
    try {
      await fs.rename(source, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      await fs.cp(source, destination, { recursive: true, errorOnExist: true });
      try {
        await shell.trashItem(source);
      } catch (trashError) {
        throw new Error('归档副本已创建，但原目录无法移入回收站，因此保留了两份。请手动核对。', { cause: trashError });
      }
    }
    return store.update((state) => {
      const target = projectById(state, projectId);
      target.archivedFrom = source;
      target.path = destination;
      target.rootPath = archiveRoot;
      state.events.push(event(target, 'moved', destination));
    });
  });

  ipcMain.handle('project:trash', async (_event, projectId: string) => {
    const project = projectById(store.get(), projectId);
    const confirm = await dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      title: '确认移入系统回收站',
      message: `将“${project.name}”的整个项目目录移入系统回收站？`,
      detail: `${project.path}\n\n不会执行永久删除。若系统回收站操作失败，应用会保留原目录。`,
      buttons: ['取消', '移入系统回收站'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (confirm.response !== 1) return store.get();
    await shell.trashItem(project.path);
    return store.update((state) => {
      state.events.push(event(project, 'trashed', project.path));
      state.projects = state.projects.filter((item) => item.id !== projectId);
    });
  });

  ipcMain.handle('export:png', async (_event, dataUrl: string) => {
    if (!dataUrl.startsWith('data:image/png;base64,')) throw new Error('导出图片格式无效。');
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '导出整个公墓',
      defaultPath: `project-graveyard-${new Date().toISOString().slice(0, 10)}.png`,
      filters: [{ name: 'PNG 图片', extensions: ['png'] }],
    });
    if (result.canceled || !result.filePath) return false;
    await fs.writeFile(result.filePath, Buffer.from(dataUrl.split(',')[1], 'base64'));
    return true;
  });
}

app.whenReady().then(async () => {
  store = new LocalStore(app.getPath('userData'));
  await store.load();
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
