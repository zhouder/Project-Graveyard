import type { AppState, GraveProject } from '../shared/types';

const day = 86_400_000;
const now = Date.now();
const ago = (days: number) => new Date(now - days * day).toISOString();

function project(data: Partial<GraveProject> & Pick<GraveProject, 'id' | 'name' | 'status' | 'technologies'>): GraveProject {
  const sleepingDays = data.sleepingDays ?? (data.status === 'alive' ? 4 : 430);
  return {
    path: `C:\\Dev\\${data.name}`,
    rootPath: 'C:\\Dev',
    markers: ['.git', 'package.json'],
    bornAt: ago(sleepingDays + 180),
    lastActiveAt: ago(sleepingDays),
    sleepingDays,
    sizeBytes: 14_200_000,
    todoCount: 7,
    todos: ['src/app.tsx:42 TODO finish settings panel', 'README.md:18 TODO add deployment guide'],
    gitState: 'clean',
    lastCommit: 'chore: update README before disappearing',
    readmeSummary: 'A small experiment that started on a quiet weekend and somehow acquired a roadmap.',
    ...data,
  };
}

const projects: GraveProject[] = [
  project({ id: 'demo-1', name: 'midnight-dashboard', status: 'dead', technologies: ['TypeScript', 'React'], bornAt: '2024-03-12T08:00:00.000Z', lastActiveAt: '2024-03-16T12:00:00.000Z', sleepingDays: 826, sizeBytes: 8_400_000, todoCount: 13, death: { date: '2024-03-16T12:00:00.000Z', cause: '需求膨胀', epitaph: '登录页面还没写完' } }),
  project({ id: 'demo-2', name: 'tiny-raytracer', status: 'dead', technologies: ['Rust'], bornAt: '2023-07-01T10:00:00.000Z', lastActiveAt: '2023-09-08T12:00:00.000Z', sizeBytes: 42_000_000, todoCount: 4, death: { date: '2023-09-08T12:00:00.000Z', cause: '只是为了学习', epitaph: '最后一束光仍然没有反射' } }),
  project({ id: 'demo-3', name: 'another-notes-app', status: 'dead', technologies: ['JavaScript', 'Electron'], bornAt: '2025-01-02T10:00:00.000Z', lastActiveAt: '2025-01-02T10:23:00.000Z', sizeBytes: 3_100_000, todoCount: 22, death: { date: '2025-01-02T10:23:00.000Z', cause: '已有替代品', epitaph: '这个项目只活了 23 分钟。' } }),
  project({ id: 'demo-4', name: 'garden-api', status: 'sleeping', technologies: ['Python'], sleepingDays: 395, sizeBytes: 26_000_000, todoCount: 17, gitState: 'dirty' }),
  project({ id: 'demo-5', name: 'pixel-weather', status: 'sleeping', technologies: ['Go'], sleepingDays: 218, sizeBytes: 5_800_000, todoCount: 3 }),
  project({ id: 'demo-6', name: 'invoice-rescue', status: 'alive', technologies: ['TypeScript', 'React'], sleepingDays: 2, sizeBytes: 74_000_000, todoCount: 9 }),
  project({ id: 'demo-7', name: 'weekend-compiler', status: 'dead', technologies: ['C/C++'], bornAt: '2022-10-12T10:00:00.000Z', lastActiveAt: '2022-12-20T10:00:00.000Z', sizeBytes: 116_000_000, death: { date: '2022-12-20T12:00:00.000Z', cause: '技术选型失败', epitaph: '语法树长得比项目更茂盛' } }),
  project({ id: 'demo-8', name: 'pomodoro-but-better', status: 'dead', technologies: ['Vue'], bornAt: '2024-08-19T10:00:00.000Z', lastActiveAt: '2024-10-03T10:00:00.000Z', sizeBytes: 19_000_000, death: { date: '2024-10-03T12:00:00.000Z', cause: '失去兴趣', epitaph: '写完 README 后失去兴趣。' } }),
  project({ id: 'demo-9', name: 'shader-playground', status: 'alive', technologies: ['TypeScript', 'WebGL'], sleepingDays: 1, sizeBytes: 31_000_000, todoCount: 6, readmeSummary: 'A real-time shader sketchbook for experimenting with light, fog, and procedural textures.' }),
  project({ id: 'demo-10', name: 'local-first-journal', status: 'alive', technologies: ['Electron', 'React'], sleepingDays: 3, sizeBytes: 48_000_000, todoCount: 11, gitState: 'dirty', readmeSummary: 'An offline journal that stores every note locally and never asks for an account.' }),
  project({ id: 'demo-11', name: 'cli-timekeeper', status: 'alive', technologies: ['Go'], sleepingDays: 5, sizeBytes: 4_600_000, todoCount: 2, readmeSummary: 'A tiny terminal timer that tracks focused work without a cloud dashboard.' }),
  project({ id: 'demo-12', name: 'wasm-image-lab', status: 'alive', technologies: ['Rust', 'WebAssembly'], sleepingDays: 7, sizeBytes: 63_000_000, todoCount: 8, readmeSummary: 'Browser-based image experiments powered by Rust and WebAssembly.' }),
  project({ id: 'demo-13', name: 'recipe-graph', status: 'sleeping', technologies: ['Vue', 'TypeScript'], sleepingDays: 242, sizeBytes: 18_000_000, todoCount: 14, readmeSummary: 'A visual map of recipes, ingredients, substitutions, and abandoned dinner plans.' }),
  project({ id: 'demo-14', name: 'home-lab-console', status: 'sleeping', technologies: ['React', 'Node.js'], sleepingDays: 330, sizeBytes: 92_000_000, todoCount: 19, gitState: 'dirty', readmeSummary: 'One dashboard intended to monitor every service running in a home lab.' }),
  project({ id: 'demo-15', name: 'markdown-publisher', status: 'sleeping', technologies: ['Python'], sleepingDays: 560, sizeBytes: 12_000_000, todoCount: 5, readmeSummary: 'A static publishing pipeline that almost became a full content management system.' }),
];

export const DEMO_STATE: AppState = {
  version: 1,
  roots: ['C:\\Dev'],
  projectPaths: [],
  projects,
  settings: { sleepAfterDays: 180, demoMode: true, language: 'zh-CN', theme: 'night' },
  events: [
    { id: 'event-1', projectId: 'demo-3', projectName: 'another-notes-app', type: 'funeral', at: '2025-01-02T10:23:00.000Z' },
    { id: 'event-2', projectId: 'demo-2', projectName: 'tiny-raytracer', type: 'revived', at: '2024-02-11T09:00:00.000Z' },
    { id: 'event-3', projectId: 'demo-2', projectName: 'tiny-raytracer', type: 'funeral', at: '2024-04-11T09:00:00.000Z' },
  ],
};
