import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalStore } from './store';

describe('local JSON store', () => {
  it('persists settings atomically and restores them', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'graveyard-store-'));
    try {
      const store = new LocalStore(directory);
      await store.load();
      await store.update((state) => { state.settings.sleepAfterDays = 365; state.roots.push('C:\\Dev'); });

      const restored = new LocalStore(directory);
      const state = await restored.load();
      expect(state.settings.sleepAfterDays).toBe(365);
      expect(state.roots).toEqual(['C:\\Dev']);
      await expect(fs.access(path.join(directory, 'graveyard.json.tmp'))).rejects.toThrow();
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it('migrates settings and project sources from the original local format', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'graveyard-legacy-'));
    try {
      await fs.writeFile(path.join(directory, 'graveyard.json'), JSON.stringify({
        version: 1,
        roots: ['C:\\Dev'],
        projects: [],
        events: [],
        settings: { sleepAfterDays: 120, demoMode: false },
      }));
      const store = new LocalStore(directory);
      const state = await store.load();
      expect(state.projectPaths).toEqual([]);
      expect(state.settings).toMatchObject({ sleepAfterDays: 120, language: 'zh-CN', theme: 'night' });
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});
