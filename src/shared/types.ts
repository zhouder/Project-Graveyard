export type ProjectStatus = 'alive' | 'sleeping' | 'dead';
export type GitState = 'clean' | 'dirty' | 'not-repository' | 'unavailable';

export interface GraveProject {
  id: string;
  name: string;
  path: string;
  rootPath: string;
  markers: string[];
  technologies: string[];
  bornAt: string;
  lastActiveAt: string;
  sleepingDays: number;
  sizeBytes: number;
  todoCount: number;
  todos: string[];
  gitState: GitState;
  lastCommit?: string;
  readmeSummary?: string;
  status: ProjectStatus;
  death?: {
    date: string;
    cause: string;
    epitaph: string;
  };
  archivedFrom?: string;
  scanError?: string;
}

export type EventType = 'discovered' | 'funeral' | 'revived' | 'moved' | 'trashed';

export interface GraveEvent {
  id: string;
  projectId: string;
  projectName: string;
  type: EventType;
  at: string;
  details?: string;
}

export interface AppSettings {
  sleepAfterDays: number;
  demoMode: boolean;
  language: 'zh-CN' | 'en-US';
  theme: 'night' | 'day';
}

export interface AppState {
  version: 1;
  roots: string[];
  projectPaths: string[];
  projects: GraveProject[];
  events: GraveEvent[];
  settings: AppSettings;
}

export interface ScanProgress {
  phase: 'discovering' | 'analyzing' | 'complete' | 'cancelled';
  currentPath: string;
  found: number;
  analyzed: number;
  errors: number;
}

export interface FuneralInput {
  projectId: string;
  date: string;
  cause: string;
  epitaph: string;
}

export interface AnnualReport {
  year: number;
  newProjects: number;
  deaths: number;
  revivals: number;
  averageLifespanDays: number;
  shortestLived?: { name: string; days: number };
  topCause?: string;
  topTechnology?: string;
}
