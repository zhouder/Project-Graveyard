import { describe, expect, it } from 'vitest';
import type { GraveEvent, GraveProject } from '../shared/types';
import { buildAnnualReport, daysBetween, formatBytes, formatDate, formatLifespan, toDateTimeLocal } from './domain';

const base: GraveProject = {
  id: 'one', name: 'short-life', path: 'C:\\one', rootPath: 'C:\\', markers: ['package.json'],
  technologies: ['TypeScript'], bornAt: '2024-01-01T00:00:00.000Z', lastActiveAt: '2024-01-05T00:00:00.000Z',
  sleepingDays: 200, sizeBytes: 1500, todoCount: 1, todos: [], gitState: 'clean', status: 'dead',
  death: { date: '2024-01-05T00:00:00.000Z', cause: '失去兴趣', epitaph: 'done' },
};

describe('domain calculations', () => {
  it('calculates lifespan as calendar-length days', () => {
    expect(daysBetween(base.bornAt, base.death!.date)).toBe(4);
  });

  it('formats byte quantities for the project list', () => {
    expect(formatBytes(1500)).toBe('1.5 KB');
    expect(formatBytes(20 * 1024 * 1024)).toBe('20 MB');
  });

  it('preserves local date and time to minute precision', () => {
    const localTime = '2024-03-12T09:07:00';
    expect(formatDate(localTime)).toBe('2024.03.12 09:07');
    expect(toDateTimeLocal(localTime)).toBe('2024-03-12T09:07');
  });

  it('describes short-lived projects with minute and hour precision', () => {
    expect(formatLifespan('2024-01-01T10:00:00', '2024-01-01T10:23:00')).toBe('23 分钟');
    expect(formatLifespan('2024-01-01T10:00:00', '2024-01-03T13:15:00')).toBe('2 天 3 小时');
  });

  it('builds a complete annual report from local history', () => {
    const second = { ...base, id: 'two', name: 'longer', bornAt: '2024-02-01T00:00:00.000Z', death: { date: '2024-02-11T00:00:00.000Z', cause: '失去兴趣', epitaph: '' }, technologies: ['TypeScript', 'React'] };
    const events: GraveEvent[] = [{ id: 'e', projectId: 'one', projectName: 'short-life', type: 'revived', at: '2024-04-01T00:00:00.000Z' }];

    const report = buildAnnualReport([base, second], events, 2024);

    expect(report).toMatchObject({ newProjects: 2, deaths: 2, revivals: 1, averageLifespanDays: 7, topCause: '失去兴趣', topTechnology: 'TypeScript' });
    expect(report.shortestLived).toEqual({ name: 'short-life', days: 4 });
  });
});
