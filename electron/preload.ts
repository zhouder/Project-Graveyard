import { contextBridge, ipcRenderer } from 'electron';
import type { AppState, FuneralInput, ScanProgress } from '../src/shared/types';

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke('state:get'),
  updateSettings: (settings: AppState['settings']): Promise<AppState> => ipcRenderer.invoke('settings:update', settings),
  selectRoots: (): Promise<AppState> => ipcRenderer.invoke('roots:select'),
  removeRoot: (root: string): Promise<AppState> => ipcRenderer.invoke('roots:remove', root),
  selectProject: (): Promise<AppState> => ipcRenderer.invoke('project-source:select'),
  removeProjectSource: (projectPath: string): Promise<AppState> => ipcRenderer.invoke('project-source:remove', projectPath),
  startScan: (): Promise<AppState> => ipcRenderer.invoke('scan:start'),
  cancelScan: (): Promise<boolean> => ipcRenderer.invoke('scan:cancel'),
  onScanProgress: (listener: (progress: ScanProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: ScanProgress) => listener(progress);
    ipcRenderer.on('scan:progress', handler);
    return () => { ipcRenderer.removeListener('scan:progress', handler); };
  },
  holdFuneral: (input: FuneralInput): Promise<AppState> => ipcRenderer.invoke('project:funeral', input),
  reviveProject: (id: string): Promise<AppState> => ipcRenderer.invoke('project:revive', id),
  openProject: (id: string): Promise<void> => ipcRenderer.invoke('project:open', id),
  archiveProject: (id: string): Promise<AppState> => ipcRenderer.invoke('project:archive', id),
  trashProject: (id: string): Promise<AppState> => ipcRenderer.invoke('project:trash', id),
  savePng: (dataUrl: string): Promise<boolean> => ipcRenderer.invoke('export:png', dataUrl),
};

contextBridge.exposeInMainWorld('graveyard', api);

export type GraveyardApi = typeof api;
