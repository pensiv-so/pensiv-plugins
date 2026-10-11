import { describe, it, expect } from 'vitest';
import type { HostApi, SessionTotals } from '@pensiv/plugin-sdk';
import {
  createGoalTracker,
  hasReading,
  shouldCelebrate,
  type GoalTracker
} from '../src/celebration';

/**
 * The goal card and the phone sheet both run `shouldCelebrate` from an effect on
 * every reading. These tests drive it the way the host's session cache does: it
 * answers all zeros until its first fill lands (cold start, and again after a
 * sign-out or sign-in), then the real totals for the account.
 */

const TARGET = 1000;
const DAY = '2026-10-11';

const totalsOf = (added: number, removed = 0, pasted = 0): SessionTotals => ({
  added: { words: added, chars: added * 5 },
  removed: { words: removed, chars: removed * 5 },
  net: { words: Math.max(0, added - removed), chars: Math.max(0, added - removed) * 5 },
  pasted: { words: pasted, chars: pasted * 5 }
});

/** The cache before its first fill, and after a sign-out. */
const UNFILLED = totalsOf(0);

function fakeStorage(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial };
  const storage = {
    get: (key: string) => store[key],
    set: (key: string, value: unknown) => {
      store[key] = value;
    },
    on: () => () => {}
  } as unknown as HostApi['storage'];
  return { store, storage };
}

/** One render of a goal surface: net words against the target, as by default. */
function render(
  tracker: GoalTracker,
  storage: HostApi['storage'],
  totals: SessionTotals,
  today = DAY
) {
  const achieved = TARGET > 0 && totals.net.words >= TARGET;
  return shouldCelebrate(tracker, storage, { achieved, hasReading: hasReading(totals), today });
}

describe('shouldCelebrate', () => {
  it('does not celebrate a goal already met when the session totals load after mount', () => {
    const { store, storage } = fakeStorage();
    const tracker = createGoalTracker();

    expect(render(tracker, storage, UNFILLED)).toBe(false); // cold start, cache empty
    expect(render(tracker, storage, totalsOf(1500))).toBe(false); // first fill lands
    expect(render(tracker, storage, totalsOf(1501))).toBe(false); // keep writing

    expect(store.celebratedOn).toBeUndefined();
  });

  it('does not celebrate after signing in to an account that already met its goal', () => {
    const { store, storage } = fakeStorage();
    const tracker = createGoalTracker();

    expect(render(tracker, storage, totalsOf(200))).toBe(false); // account A, under
    expect(render(tracker, storage, UNFILLED)).toBe(false); // signed out
    expect(render(tracker, storage, totalsOf(1500))).toBe(false); // account B, already over

    expect(store.celebratedOn).toBeUndefined();
  });

  it('does not celebrate signing back in to the same account', () => {
    const { storage } = fakeStorage();
    const tracker = createGoalTracker();

    expect(render(tracker, storage, totalsOf(1500))).toBe(false);
    expect(render(tracker, storage, UNFILLED)).toBe(false);
    expect(render(tracker, storage, totalsOf(1500))).toBe(false);
  });

  it('celebrates once when writing reaches the goal after a late load', () => {
    const { store, storage } = fakeStorage();
    const tracker = createGoalTracker();

    expect(render(tracker, storage, UNFILLED)).toBe(false);
    expect(render(tracker, storage, totalsOf(990))).toBe(false);
    expect(render(tracker, storage, totalsOf(1000))).toBe(true);
    expect(render(tracker, storage, totalsOf(1000))).toBe(false); // same reading again

    // Dropping under and back over the same day doesn't celebrate again.
    expect(render(tracker, storage, totalsOf(1000, 20))).toBe(false);
    expect(render(tracker, storage, totalsOf(1030, 20))).toBe(false);

    expect(store.celebratedOn).toBe(DAY);
  });

  it('celebrates on a fresh day that starts with nothing written', () => {
    const { storage } = fakeStorage();
    const tracker = createGoalTracker();

    expect(render(tracker, storage, UNFILLED)).toBe(false); // nothing written yet today
    expect(render(tracker, storage, totalsOf(4))).toBe(false); // first edit
    expect(render(tracker, storage, totalsOf(1000))).toBe(true);
  });

  it('celebrates the next day after the totals roll over', () => {
    const { store, storage } = fakeStorage({ celebratedOn: '2026-10-10' });
    const tracker = createGoalTracker();

    expect(render(tracker, storage, totalsOf(1800), '2026-10-10')).toBe(false); // yesterday, met
    expect(render(tracker, storage, UNFILLED, DAY)).toBe(false); // rolled over, nothing yet
    expect(render(tracker, storage, totalsOf(12), DAY)).toBe(false);
    expect(render(tracker, storage, totalsOf(1000), DAY)).toBe(true);

    expect(store.celebratedOn).toBe(DAY);
  });

  it('does not celebrate a day that was celebrated before', () => {
    const { storage } = fakeStorage({ celebratedOn: DAY });
    const tracker = createGoalTracker();

    expect(render(tracker, storage, totalsOf(999))).toBe(false);
    expect(render(tracker, storage, totalsOf(1000))).toBe(false);
  });

  it('takes the baseline from the warm totals when a surface remounts', () => {
    const { storage } = fakeStorage();
    // e.g. after switching projects: the cache is account-wide and already filled.
    const tracker = createGoalTracker();

    expect(render(tracker, storage, totalsOf(1500))).toBe(false);
    expect(render(tracker, storage, totalsOf(1501))).toBe(false);
  });
});

describe('hasReading', () => {
  it('is false for the empty cache', () => {
    expect(hasReading(UNFILLED)).toBe(false);
    expect(
      hasReading({
        added: { words: 0, chars: 0 },
        removed: { words: 0, chars: 0 },
        net: { words: 0, chars: 0 }
      })
    ).toBe(false);
  });

  it('counts a day whose net is zero as a reading', () => {
    expect(hasReading(totalsOf(50, 50))).toBe(true);
  });

  it('counts pasted-only and characters-only totals as readings', () => {
    expect(hasReading(totalsOf(0, 0, 3))).toBe(true);
    expect(
      hasReading({
        added: { words: 0, chars: 2 },
        removed: { words: 0, chars: 0 },
        net: { words: 0, chars: 2 }
      })
    ).toBe(true);
  });
});
