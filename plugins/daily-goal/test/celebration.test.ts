import { afterAll, describe, it, expect, vi } from 'vitest';
import type { HostApi, SessionBasis, SessionTotals } from '@pensiv/plugin-sdk';
import {
  createGoalTracker,
  hasReading,
  shouldCelebrate,
  writingDay,
  type GoalTracker
} from '../src/celebration';

// pensiv's writers are mostly in KST, where the UTC date turns over at 09:00 —
// the day-key tests below are about exactly that gap.
vi.stubEnv('TZ', 'Asia/Seoul');
afterAll(() => vi.unstubAllEnvs());

/**
 * The goal card and the phone sheet both run `shouldCelebrate` from an effect on
 * every reading. These tests drive it the way the host's session cache does: it
 * answers all zeros until its first fill lands (cold start, and again after a
 * sign-out or sign-in), then the real totals for the account, with a `basis`
 * saying which writing day they cover and what they were built from.
 */

const TARGET = 1000;
const DAY = '2026-10-11';
const BASIS: SessionBasis = { day: DAY, source: '1:2026-10-10T15:00:00.000Z:server' };

const totalsOf = (added: number, removed = 0, pasted = 0, basis: SessionBasis | null = BASIS) => {
  const totals: SessionTotals = {
    added: { words: added, chars: added * 5 },
    removed: { words: removed, chars: removed * 5 },
    net: { words: Math.max(0, added - removed), chars: Math.max(0, added - removed) * 5 },
    pasted: { words: pasted, chars: pasted * 5 }
  };
  return basis ? { ...totals, basis } : totals;
};

/** The cache before its first fill, and after a sign-out: zeros, no basis. */
const UNFILLED = totalsOf(0, 0, 0, null);

/** A host from before `basis`: same numbers, nothing about where they came from. */
const legacy = (added: number, removed = 0) => totalsOf(added, removed, 0, null);

/** A KST wall-clock time, e.g. `kst('2026-10-11T08:00')`. */
const kst = (local: string) => new Date(`${local}:00+09:00`);

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
  { now = new Date(), dayStartHour = 0 }: { now?: Date; dayStartHour?: number } = {}
) {
  const achieved = TARGET > 0 && totals.net.words >= TARGET;
  return shouldCelebrate(tracker, storage, {
    achieved,
    hasReading: hasReading(totals),
    source: totals.basis?.source,
    day: writingDay(totals, dayStartHour, now)
  });
}

describe('shouldCelebrate', () => {
  it('does not celebrate a goal already met when the session totals load after mount', () => {
    const { store, storage } = fakeStorage();
    const tracker = createGoalTracker();

    expect(render(tracker, storage, UNFILLED)).toBe(false); // cold start, cache empty
    expect(render(tracker, storage, totalsOf(1500))).toBe(false); // first fill lands
    expect(render(tracker, storage, totalsOf(1501))).toBe(false); // keep writing

    expect(store.celebratedDay).toBeUndefined();
  });

  it('does not celebrate after signing in to an account that already met its goal', () => {
    const { store, storage } = fakeStorage();
    const tracker = createGoalTracker();

    expect(render(tracker, storage, totalsOf(200))).toBe(false); // account A, under
    expect(render(tracker, storage, UNFILLED)).toBe(false); // signed out
    expect(render(tracker, storage, totalsOf(1500))).toBe(false); // account B, already over

    expect(store.celebratedDay).toBeUndefined();
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

    expect(store.celebratedDay).toBe(DAY);
  });

  it('celebrates on a fresh day that starts with nothing written', () => {
    const { storage } = fakeStorage();
    const tracker = createGoalTracker();

    expect(render(tracker, storage, UNFILLED)).toBe(false); // nothing written yet today
    expect(render(tracker, storage, totalsOf(4))).toBe(false); // first edit
    expect(render(tracker, storage, totalsOf(1000))).toBe(true);
  });

  it('does not celebrate a day that was celebrated before', () => {
    const { storage } = fakeStorage({ celebratedDay: DAY });
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

describe('once per local writing day', () => {
  it('runs in KST', () => {
    expect(kst('2026-10-11T08:00').getHours()).toBe(8);
    expect(kst('2026-10-11T08:00').toISOString().slice(0, 10)).toBe('2026-10-10');
  });

  it('does not celebrate a KST-morning goal again after a relaunch', () => {
    const { store, storage } = fakeStorage();

    // 08:00 KST (still the 10th in UTC): the goal is reached and celebrated.
    const morning = createGoalTracker();
    const at8 = { now: kst('2026-10-11T08:00') };
    expect(render(morning, storage, legacy(990), at8)).toBe(false);
    expect(render(morning, storage, legacy(1000), at8)).toBe(true);
    expect(store.celebratedDay).toBe('2026-10-11');

    // 10:00 KST relaunch (the 11th in UTC) on a host that can't say where its
    // totals came from: this device's numbers first, the server's a moment later.
    const relaunch = createGoalTracker();
    const at10 = { now: kst('2026-10-11T10:00') };
    expect(render(relaunch, storage, UNFILLED, at10)).toBe(false);
    expect(render(relaunch, storage, legacy(400), at10)).toBe(false);
    expect(render(relaunch, storage, legacy(1500), at10)).toBe(false);
  });

  it('celebrates again on the next local day', () => {
    // Celebrated at 10:00 KST on the 11th; it is now 01:00 KST on the 12th,
    // which is still the 11th in UTC.
    const { store, storage } = fakeStorage({ celebratedDay: '2026-10-11' });
    const tracker = createGoalTracker();
    const next = { now: kst('2026-10-12T01:00') };

    expect(render(tracker, storage, legacy(5), next)).toBe(false);
    expect(render(tracker, storage, legacy(1000), next)).toBe(true);
    expect(store.celebratedDay).toBe('2026-10-12');
  });

  it('does not celebrate a dip and re-cross on the same local day across UTC midnight', () => {
    const { storage } = fakeStorage();
    const tracker = createGoalTracker();

    expect(render(tracker, storage, legacy(990), { now: kst('2026-10-11T08:30') })).toBe(false);
    expect(render(tracker, storage, legacy(1000), { now: kst('2026-10-11T08:30') })).toBe(true);
    // An hour later (UTC has moved to the 11th): delete some, write it back.
    expect(render(tracker, storage, legacy(1000, 30), { now: kst('2026-10-11T09:30') })).toBe(
      false
    );
    expect(render(tracker, storage, legacy(1040, 30), { now: kst('2026-10-11T09:30') })).toBe(
      false
    );
  });

  it('keeps the small hours on the previous writing day with a shifted day start', () => {
    const { storage } = fakeStorage({ celebratedDay: '2026-10-11' });
    const tracker = createGoalTracker();
    const late = { now: kst('2026-10-12T02:00'), dayStartHour: 4 };

    // 02:00 on the 12th is still the 11th's writing day: already celebrated.
    expect(render(tracker, storage, legacy(990), late)).toBe(false);
    expect(render(tracker, storage, legacy(1000), late)).toBe(false);
  });

  it('uses the day the host says the totals cover', () => {
    const { store, storage } = fakeStorage();
    const tracker = createGoalTracker();
    // The host drew these from the 11th's window even though the local clock
    // already reads the 12th — the host's word wins.
    const basis = { day: '2026-10-11', source: 'a' };
    const now = { now: kst('2026-10-12T00:30') };

    expect(render(tracker, storage, totalsOf(990, 0, 0, basis), now)).toBe(false);
    expect(render(tracker, storage, totalsOf(1000, 0, 0, basis), now)).toBe(true);
    expect(store.celebratedDay).toBe('2026-10-11');
  });

  it('does not let the old UTC `celebratedOn` key count as today', () => {
    const { store, storage } = fakeStorage({ celebratedOn: '2026-10-11' });
    const tracker = createGoalTracker();
    const at = { now: kst('2026-10-11T20:00') };

    expect(render(tracker, storage, legacy(990), at)).toBe(false);
    expect(render(tracker, storage, legacy(1000), at)).toBe(true);
    expect(store.celebratedDay).toBe('2026-10-11');
  });
});

describe('totals rebuilt on another basis', () => {
  const local: SessionBasis = { day: DAY, source: '1:2026-10-10T15:00:00.000Z:local' };
  const server: SessionBasis = { day: DAY, source: '1:2026-10-10T15:00:00.000Z:server' };

  it('does not celebrate the cross-device baseline arriving after an offline start', () => {
    const { store, storage } = fakeStorage();
    const tracker = createGoalTracker();

    expect(render(tracker, storage, totalsOf(400, 0, 0, local))).toBe(false); // this device only
    expect(render(tracker, storage, totalsOf(1500, 0, 0, server))).toBe(false); // other devices land
    expect(render(tracker, storage, totalsOf(1510, 0, 0, server))).toBe(false);
    expect(store.celebratedDay).toBeUndefined();
  });

  it('still celebrates writing past the goal after the baseline arrives', () => {
    const { storage } = fakeStorage();
    const tracker = createGoalTracker();

    expect(render(tracker, storage, totalsOf(400, 0, 0, local))).toBe(false);
    expect(render(tracker, storage, totalsOf(990, 0, 0, server))).toBe(false);
    expect(render(tracker, storage, totalsOf(1000, 0, 0, server))).toBe(true);
  });

  it('does not celebrate a shifted-day window replacing the midnight fallback', () => {
    const { storage } = fakeStorage();
    const tracker = createGoalTracker();
    const midnight: SessionBasis = { day: DAY, source: '1:2026-10-10T15:00:00.000Z:server' };
    const fourAm: SessionBasis = { day: '2026-10-10', source: '1:2026-10-09T19:00:00.000Z:server' };

    expect(render(tracker, storage, totalsOf(600, 0, 0, midnight))).toBe(false);
    expect(render(tracker, storage, totalsOf(1300, 0, 0, fourAm))).toBe(false);
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

describe('writingDay', () => {
  it('is the local date, not the UTC one', () => {
    expect(writingDay(legacy(1), 0, kst('2026-10-11T08:00'))).toBe('2026-10-11');
  });

  it('keeps the hours before the day start on the previous day', () => {
    expect(writingDay(legacy(1), 4, kst('2026-10-12T03:59'))).toBe('2026-10-11');
    expect(writingDay(legacy(1), 4, kst('2026-10-12T04:00'))).toBe('2026-10-12');
  });
});
