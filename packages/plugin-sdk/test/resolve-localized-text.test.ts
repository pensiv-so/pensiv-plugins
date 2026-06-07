import { describe, it, expect } from 'vitest';
import { resolveLocalizedText } from '../src/types';

// The SDK source is mirror-generated from the app; this guards the resolution
// contract plugins (and the host's schema labels) depend on against a bad mirror.
describe('resolveLocalizedText', () => {
  it('passes a plain string through unchanged', () => {
    expect(resolveLocalizedText('hello', 'ko')).toBe('hello');
  });

  it('returns an empty string for undefined', () => {
    expect(resolveLocalizedText(undefined, 'en')).toBe('');
  });

  it('prefers an exact language match', () => {
    expect(resolveLocalizedText({ en: 'Start', ko: '시작', ja: '始める' }, 'ko')).toBe('시작');
  });

  it('falls back from a regional tag to its base language', () => {
    expect(resolveLocalizedText({ en: 'Start', ko: '시작' }, 'ko-KR')).toBe('시작');
  });

  it('falls back to English when the requested language is absent', () => {
    expect(resolveLocalizedText({ en: 'Start', ja: '始める' }, 'ko')).toBe('Start');
  });

  it('falls back to the first available value when there is no English', () => {
    expect(resolveLocalizedText({ fr: 'Démarrer' }, 'ko')).toBe('Démarrer');
  });

  it('defaults to English when no language is given', () => {
    expect(resolveLocalizedText({ en: 'Start', ko: '시작' })).toBe('Start');
  });

  it('returns an empty string for an empty map', () => {
    expect(resolveLocalizedText({}, 'en')).toBe('');
  });
});
