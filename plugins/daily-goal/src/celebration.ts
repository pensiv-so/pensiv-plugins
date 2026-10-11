import type { HostApi, SessionTotals } from '@pensiv/plugin-sdk';

/**
 * When the goal surfaces (floating card, phone sheet) fire their confetti.
 *
 * The rule: once per writing day, at the moment today's progress goes from
 * under the goal to at or over it by writing. Progress that is already over the
 * goal when a surface mounts hasn't just been reached, so the first reading is
 * only a baseline — and so is the first reading after the host rebuilds the
 * totals on another basis (see {@link GoalReading.source}).
 */

/**
 * Storage key of the last celebrated writing day, `YYYY-MM-DD` local.
 *
 * Replaces `celebratedOn`, which held a UTC date: in KST that turns over at
 * 09:00, so a morning goal could celebrate twice in one writing day and a
 * goal reached after midnight could be swallowed by yesterday's key. The old
 * key is no longer read, so it counts as "not today".
 */
export const CELEBRATED_DAY_KEY = 'celebratedDay';

/** What a goal surface remembers between renders. */
export interface GoalTracker {
  /** Whether the last reading was at or over the goal; `null` before the first. */
  achieved: boolean | null;
  /** The `source` of that reading. */
  source: string | undefined;
}

export interface GoalReading {
  achieved: boolean;
  /** Whether the totals behind `achieved` are a reading — see {@link hasReading}. */
  hasReading: boolean;
  /**
   * `totals.basis?.source`. It changes when the host rebuilds the totals
   * rather than the user writing: another account, another day window, the
   * cross-device baseline arriving after an offline start. A jump across it
   * isn't progress. Hosts from before `basis` leave it undefined throughout.
   */
  source: string | undefined;
  /** The writing day the totals cover — see {@link writingDay}. */
  day: string;
}

export const createGoalTracker = (): GoalTracker => ({ achieved: null, source: undefined });

/**
 * Whether the host's totals are a reading.
 *
 * The session cache answers all zeros until its first fill lands — on a cold
 * start, and again after a sign-out or sign-in — and the goal surfaces are
 * mounted before that. The host marks a filled reading with `basis`, so zeros
 * that carry one are real: nothing written yet today, a baseline like any other,
 * from which a first paste or burst that already reaches the goal celebrates.
 *
 * A host from before `basis` can't say. There, all-zero totals are taken for
 * "not loaded", and the first non-zero totals become the baseline — which
 * misses a goal reached by the day's very first reading.
 */
export function hasReading(totals: SessionTotals): boolean {
  if (totals.basis) return true;
  const groups = [totals.added, totals.removed, totals.net, totals.pasted];
  return groups.some((p) => !!p && (p.words > 0 || p.chars > 0));
}

const pad = (n: number) => `${n}`.padStart(2, '0');

/**
 * The writing day `totals` belong to, `YYYY-MM-DD` in local time.
 *
 * The host says (`basis.day`), and then it is the very day the totals were drawn
 * from. A host from before `basis` doesn't, so it is worked out the way those
 * hosts draw the window: the local date the day starts on, `dayStartHour` hours
 * past midnight, so the small hours before it still belong to the day before.
 */
export function writingDay(
  totals: SessionTotals,
  dayStartHour: number,
  now: Date = new Date()
): string {
  if (totals.basis?.day) return totals.basis.day;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), dayStartHour);
  if (now < start) start.setDate(start.getDate() - 1);
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
}

/**
 * Feed one reading; returns `true` when the caller should celebrate it, and
 * records the writing day so it doesn't celebrate again that day.
 *
 * Idempotent for a repeated reading, so calling it on every render is the same
 * as calling it only when the reading changes.
 */
export function shouldCelebrate(
  tracker: GoalTracker,
  storage: HostApi['storage'],
  reading: GoalReading
): boolean {
  // No reading, no baseline. Taking the empty cache's zeros as the baseline made
  // the first fill look as if the goal had just been reached. Forgetting the
  // previous baseline too means the totals that come back after a gap — another
  // account's, after a sign-in — are a fresh baseline, not a step from the old one.
  if (!reading.hasReading) {
    tracker.achieved = null;
    return false;
  }
  if (tracker.source !== reading.source) {
    tracker.source = reading.source;
    tracker.achieved = null;
  }
  if (tracker.achieved === null) {
    tracker.achieved = reading.achieved;
    return false;
  }
  const reached = reading.achieved && !tracker.achieved;
  tracker.achieved = reading.achieved;

  if (!reached || storage.get<string>(CELEBRATED_DAY_KEY) === reading.day) return false;
  storage.set(CELEBRATED_DAY_KEY, reading.day);
  return true;
}
