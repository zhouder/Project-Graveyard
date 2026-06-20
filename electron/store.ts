import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AppState, GraveEvent, GraveProject } from '../src/shared/types';

export const DEFAULT_STATE: AppState = {
  version: 1,
  roots: [],
  projectPaths: [],
  projects: [],
  events: [],
  settings: { sleepAfterDays: 180, demoMode: false, language: 'zh-CN', theme: 'night' },
};

export class LocalStore {
  private state: AppState = structuredClone(DEFAULT_STATE);
  private readonly filePath: string;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, 'graveyard.json');
  }

  async load(): Promise<AppState> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version !== 1 || !Array.isArray(parsed.projects)) throw new Error('Unsupported data format');
      parsed.projectPaths = Array.isArray(parsed.projectPaths) ? parsed.projectPaths : [];
      parsed.settings = { ...DEFAULT_STATE.settings, ...parsed.settings };
      this.state = parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        await fs.copyFile(this.filePath, `${this.filePath}.broken-${Date.now()}`).catch(() => undefined);
      }
      this.state = structuredClone(DEFAULT_STATE);
    }
    return this.get();
  }

  get(): AppState {
    return structuredClone(this.state);
  }

  async replace(state: AppState): Promise<AppState> {
    this.state = structuredClone(state);
    await this.flush();
    return this.get();
  }

  async update(mutator: (state: AppState) => void): Promise<AppState> {
    mutator(this.state);
    await this.flush();
    return this.get();
  }

  addEvent(project: GraveProject, type: GraveEvent['type'], details?: string): GraveEvent {
    const event = { id: randomUUID(), projectId: project.id, projectName: project.name, type, at: new Date().toISOString(), details };
    this.state.events.push(event);
    return event;
  }

  private async flush() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(this.state, null, 2), 'utf8');
    await fs.rename(tempPath, this.filePath);
  }
}
