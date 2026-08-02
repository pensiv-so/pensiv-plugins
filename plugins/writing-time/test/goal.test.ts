import { describe, it, expect } from 'vitest';
import type { HostApi, WidgetProps } from '@pensiv/plugin-sdk';
import { formatDuration } from '../src/i18n';
import { goalPercent, targetMinutes, DEFAULT_TARGET_MINUTES } from '../src/session';

/**
 * The two pure pieces behind every surface: how a duration is spelled in each
 * UI language, and how the goal share is derived. Both are read by the card,
 * the chip and the sheet, so a change here shows up in three places at once.
 */

/** Minimal host stub — only the fields these helpers touch. */
const host = (locale: string, storage: Record<string, unknown> = {}): WidgetProps['app'] =>
  ({
    app: { locale },
    storage: { get: (key: string) => storage[key] }
  }) as unknown as HostApi;

describe('formatDuration', () => {
  it('spells minutes-only durations per locale', () => {
    expect(formatDuration(host('en'), 24 * 60_000)).toBe('24m');
    expect(formatDuration(host('ko'), 24 * 60_000)).toBe('24분');
    expect(formatDuration(host('ja'), 24 * 60_000)).toBe('24分');
  });

  it('drops the minutes on a whole hour', () => {
    expect(formatDuration(host('en'), 60 * 60_000)).toBe('1h');
    expect(formatDuration(host('ko'), 60 * 60_000)).toBe('1시간');
    expect(formatDuration(host('ja'), 60 * 60_000)).toBe('1時間');
  });

  it('keeps both parts when there is a remainder', () => {
    expect(formatDuration(host('en'), 84 * 60_000)).toBe('1h 24m');
    expect(formatDuration(host('ko-KR'), 84 * 60_000)).toBe('1시간 24분');
    expect(formatDuration(host('ja'), 84 * 60_000)).toBe('1時間24分');
  });

  it('falls back to English for an unknown locale and floors partial minutes', () => {
    expect(formatDuration(host('de'), 90 * 60_000)).toBe('1h 30m');
    expect(formatDuration(host('en'), 59_999)).toBe('0m');
    expect(formatDuration(host('en'), -5)).toBe('0m');
  });
});

describe('targetMinutes', () => {
  it('defaults when unset', () => {
    expect(targetMinutes(host('en'))).toBe(DEFAULT_TARGET_MINUTES);
  });

  it('honours a configured value, including 0 (goal off)', () => {
    expect(targetMinutes(host('en', { targetMinutes: 25 }))).toBe(25);
    expect(targetMinutes(host('en', { targetMinutes: 0 }))).toBe(0);
  });

  it('ignores junk rather than rendering NaN%', () => {
    expect(targetMinutes(host('en', { targetMinutes: -10 }))).toBe(DEFAULT_TARGET_MINUTES);
    expect(targetMinutes(host('en', { targetMinutes: 'sixty' }))).toBe(DEFAULT_TARGET_MINUTES);
  });
});

describe('goalPercent', () => {
  it('rounds the share of the target', () => {
    expect(goalPercent(host('en', { targetMinutes: 60 }), 30 * 60_000)).toBe(50);
    expect(goalPercent(host('en', { targetMinutes: 60 }), 2 * 60_000)).toBe(3);
  });

  it('clamps at 100 once the goal is passed', () => {
    expect(goalPercent(host('en', { targetMinutes: 30 }), 90 * 60_000)).toBe(100);
  });

  it('is 0 when the goal is switched off', () => {
    expect(goalPercent(host('en', { targetMinutes: 0 }), 90 * 60_000)).toBe(0);
  });
});
