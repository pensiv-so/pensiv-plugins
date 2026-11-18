import { describe, expect, it } from 'vitest';
import { defaultGoalType } from '../src/goalType';

// PNSV-244: a Korean or Japanese writer's goal starts in characters, like the editor's counter.
describe('defaultGoalType', () => {
  it('is characters for Korean and Japanese', () => {
    expect(defaultGoalType('ko')).toBe('characters');
    expect(defaultGoalType('ko-KR')).toBe('characters');
    expect(defaultGoalType('ja-JP')).toBe('characters');
  });

  it('is words for every other language, or none', () => {
    expect(defaultGoalType('en-US')).toBe('words');
    expect(defaultGoalType('de')).toBe('words');
    expect(defaultGoalType(undefined)).toBe('words');
  });
});
