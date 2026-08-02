import { describe, it, expect } from 'vitest';
import { tint } from '../src/controls';

// The badge tint is computed rather than delegated to `color-mix()`, because an
// unsupported `color-mix` is an invalid declaration (the background silently
// disappears) instead of a graceful fallback. These are the shapes a user's
// colour setting can actually arrive in.
describe('tint', () => {
  it('turns a 6-digit hex into rgba at the given alpha', () => {
    expect(tint('#2f7ce0', 0.15)).toBe('rgba(47, 124, 224, 0.15)');
  });

  it('expands 3-digit hex', () => {
    expect(tint('#0a3', 0.5)).toBe('rgba(0, 170, 51, 0.5)');
  });

  it('tolerates a missing hash and uppercase', () => {
    expect(tint('78B336', 0.15)).toBe('rgba(120, 179, 54, 0.15)');
  });

  it('falls back to the colour itself when it is not hex', () => {
    // Legible, if not tinted — better than an invalid background.
    expect(tint('rebeccapurple', 0.15)).toBe('rebeccapurple');
  });
});
