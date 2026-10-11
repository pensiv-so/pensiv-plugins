import type { HostApi, SessionTotals } from '@pensiv/plugin-sdk';

/**
 * When the goal surfaces (floating card, phone sheet) fire their confetti.
 *
 * The rule: once per day, at the moment today's progress goes from under the
 * goal to at or over it. Progress that is already over the goal when a surface
 * mounts hasn't just been reached, so the first reading is only a baseline.
 */

/** What a goal surface remembers between renders. */
export interface GoalTracker {
  /** Whether the last reading was at or over the goal; `null` before the first. */
  achieved: boolean | null;
}

export interface GoalReading {
  achieved: boolean;
  /** Whether the totals behind `achieved` are a reading — see {@link hasReading}. */
  hasReading: boolean;
  /** The day key `celebratedOn` is compared against. */
  today: string;
}

export const createGoalTracker = (): GoalTracker => ({ achieved: null });

/**
 * Whether the host's totals are a reading.
 *
 * The session cache answers all zeros until its first fill lands — on a cold
 * start, and again after a sign-out or sign-in — and the goal surfaces are
 * mounted before that. A day with nothing written yet reads all zeros too; not
 * taking a baseline from it costs nothing, since the first edit brings a small
 * reading that becomes the baseline instead.
 */
export function hasReading(totals: SessionTotals): boolean {
  const groups = [totals.added, totals.removed, totals.net, totals.pasted];
  return groups.some((p) => !!p && (p.words > 0 || p.chars > 0));
}

/**
 * Feed one reading; returns `true` when the caller should celebrate it, and
 * records the day in `celebratedOn` so it doesn't celebrate again that day.
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
  if (tracker.achieved === null) {
    tracker.achieved = reading.achieved;
    return false;
  }
  const reached = reading.achieved && !tracker.achieved;
  tracker.achieved = reading.achieved;

  if (!reached || storage.get<string>('celebratedOn') === reading.today) return false;
  storage.set('celebratedOn', reading.today);
  return true;
}
