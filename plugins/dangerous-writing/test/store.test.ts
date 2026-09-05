// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dwStore, type SessionConfig, type SessionHooks } from '../src/store';

/**
 * The session state machine is the dangerous part — a misfire either wipes work
 * that should have been safe, or fails to wipe when the fuse runs out. Fake
 * timers make the fuse + countdown deterministic; a tiny in-memory surface stands
 * in for the real editor.
 */
const baseConfig: SessionConfig = {
  goalType: 'time',
  durationSec: 10,
  wordTarget: 5,
  fuseSec: 5,
  hardcore: false,
  clipboard: 'all'
};

/** A fake target surface: a mutable word count + a wipe that zeroes it. */
function fakeSurface(initialWords = 0) {
  const state = { words: initialWords, wiped: false };
  const hooks: SessionHooks = {
    words: () => state.words,
    wipe: () => {
      state.words = 0;
      state.wiped = true;
    }
  };
  return { state, hooks };
}

describe('dwStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dwStore.feedback = {};
    dwStore.reset();
  });

  afterEach(() => {
    dwStore.reset();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('wipes the surface when the fuse runs out', () => {
    const { state, hooks } = fakeSurface();
    const onFail = vi.fn();
    dwStore.feedback.onFail = onFail;
    dwStore.start(baseConfig, hooks);

    // Just under the fuse: still running, danger climbing.
    vi.advanceTimersByTime(4000);
    expect(dwStore.status).toBe('running');
    expect(dwStore.dangerLevel).toBeCloseTo(0.8, 1);
    expect(state.wiped).toBe(false);

    // Crossing the 5s fuse fails and wipes.
    vi.advanceTimersByTime(1100);
    expect(dwStore.status).toBe('failed');
    expect(state.wiped).toBe(true);
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it('resets the fuse on every keystroke so steady typing survives', () => {
    const { state, hooks } = fakeSurface();
    dwStore.start({ ...baseConfig, durationSec: 60 }, hooks);

    // Type a word every 3s for 12s — never idle long enough to trip the 5s fuse.
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(3000);
      state.words += 1;
      dwStore.activity();
    }
    expect(dwStore.status).toBe('running');
    expect(dwStore.dangerLevel).toBeLessThan(0.1);
  });

  it('hits a time goal by surviving the full duration', () => {
    const { state, hooks } = fakeSurface();
    const onSuccess = vi.fn();
    dwStore.feedback.onSuccess = onSuccess;
    dwStore.start(baseConfig, hooks);

    // Keep the fuse alive across the 10s duration.
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(1000);
      state.words += 1;
      dwStore.activity();
    }
    expect(dwStore.status).toBe('success');
    expect(state.wiped).toBe(false);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('hits a word goal the instant the target is reached', () => {
    const { state, hooks } = fakeSurface(2); // 2 words already present
    dwStore.start({ ...baseConfig, goalType: 'words', wordTarget: 5 }, hooks);

    state.words = 6; // 4 written — not there yet (target counts words *added*)
    dwStore.activity();
    expect(dwStore.status).toBe('running');

    state.words = 7; // 5 added → goal
    dwStore.activity();
    expect(dwStore.status).toBe('success');
    expect(dwStore.progressWords).toBe(5);
  });

  it('cancel ends safely without wiping', () => {
    const { state, hooks } = fakeSurface(3);
    dwStore.start(baseConfig, hooks);
    dwStore.cancel();
    vi.advanceTimersByTime(20_000);
    expect(dwStore.status).toBe('idle');
    expect(state.wiped).toBe(false);
  });

  it('self-clears a finished result after the lingering window', () => {
    const { hooks } = fakeSurface();
    dwStore.start(baseConfig, hooks);
    vi.advanceTimersByTime(6000); // fuse (5s) fails → failed, then auto-reset timer set
    expect(dwStore.status).toBe('failed');
    vi.advanceTimersByTime(6000);
    expect(dwStore.status).toBe('idle');
  });
});
