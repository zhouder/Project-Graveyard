import { describe, expect, it } from 'vitest';
import { causeLabel, epitaphSuggestions, tr } from './i18n';

describe('interface translations', () => {
  it('provides stable Chinese and English labels', () => {
    expect(tr('zh-CN', 'scan.project')).toBe('添加单个项目');
    expect(tr('en-US', 'scan.project')).toBe('Add one project');
    expect(tr('en-US', 'theme.night')).toBe('Switch to night');
    expect(causeLabel('en-US', '需求膨胀')).toBe('Scope creep');
  });

  it('provides localized epitaph suggestions for the funeral flow', () => {
    expect(epitaphSuggestions('zh-CN')).toContain('愿 TODO 安息。');
    expect(epitaphSuggestions('en-US')).toContain('It worked on my machine.');
  });
});
