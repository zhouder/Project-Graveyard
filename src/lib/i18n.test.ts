import { describe, expect, it } from 'vitest';
import { causeLabel, tr } from './i18n';

describe('interface translations', () => {
  it('provides stable Chinese and English labels', () => {
    expect(tr('zh-CN', 'scan.project')).toBe('添加单个项目');
    expect(tr('en-US', 'scan.project')).toBe('Add one project');
    expect(tr('en-US', 'theme.night')).toBe('Switch to night');
    expect(causeLabel('en-US', '需求膨胀')).toBe('Scope creep');
  });
});
