import * as React from 'react';
import type { SessionTotals, WidgetProps } from '@pensiv/plugin-sdk';

/**
 * The plugin's whole read of the host session, shared by the card, the chip and
 * the sheet — one hook, so the three surfaces can never disagree (and no import
 * cycle between them).
 */

const ZERO: SessionTotals = {
  added: { words: 0, chars: 0 },
  removed: { words: 0, chars: 0 },
  net: { words: 0, chars: 0 }
};

/**
 * The hour this plugin's writing day starts, 0-23 (0 = midnight).
 *
 * Stored by a `select`, so it arrives as a string; a number is tolerated in case
 * the value was written by something else. This is the plugin's own boundary —
 * moving it does not change what any other plugin reads.
 */
export function dayStartHour(app: WidgetProps['app']): number {
  const raw = app.storage.get<string | number>('dayStartHour');
  const hour = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw;
  if (typeof hour !== 'number' || !Number.isFinite(hour)) return 0;
  return Math.min(23, Math.max(0, Math.trunc(hour)));
}

/** Today's totals, guarded against an unavailable session — render-safe. */
export function todaySafe(app: WidgetProps['app']): SessionTotals {
  try {
    const hour = dayStartHour(app);
    // `today()` is always midnight; the boundary only travels on `countToday`.
    // An older host without it falls back to midnight rather than breaking.
    if (hour !== 0 && typeof app.session.countToday === 'function') {
      return app.session.countToday({ dayStartHour: hour });
    }
    return app.session.today();
  } catch {
    return ZERO;
  }
}

/** Live active-writing-time, re-read on every host tick. */
export function useActiveMs(app: WidgetProps['app']): { ms: number; writing: boolean } {
  // Read through a helper so the initial state and every tick apply the same
  // boundary — reading one on midnight and the other on the plugin's hour would
  // make the widget jump on its first tick.
  const readMs = () => {
    try {
      return app.session.activeMs({ dayStartHour: dayStartHour(app) });
    } catch {
      return 0;
    }
  };
  const [ms, setMs] = React.useState(readMs);
  const [writing, setWriting] = React.useState(false);

  React.useEffect(() => {
    const read = () => setMs(readMs());
    // `tick` fires roughly once a second, but only during a writing stretch —
    // so this is a live counter that costs nothing while the user is idle.
    const offTick = app.session.on('tick', read);
    const offStart = app.session.on('write-start', () => {
      setWriting(true);
      read();
    });
    const offStop = app.session.on('write-stop', () => {
      setWriting(false);
      read();
    });
    return () => {
      offTick();
      offStart();
      offStop();
    };
  }, [app]);

  return { ms, writing };
}

/** Default daily writing-time target, in minutes. */
export const DEFAULT_TARGET_MINUTES = 60;

/** Configured daily writing-time target, in minutes. `0` disables the goal. */
export function targetMinutes(app: WidgetProps['app']): number {
  const raw = app.storage.get<number>('targetMinutes');
  return typeof raw === 'number' && raw >= 0 ? raw : DEFAULT_TARGET_MINUTES;
}

/** Today's share of the goal, clamped to 100. `0` when no target is set. */
export function goalPercent(app: WidgetProps['app'], ms: number): number {
  const minutes = targetMinutes(app);
  if (minutes <= 0) return 0;
  return Math.min(100, Math.round((ms / (minutes * 60_000)) * 100));
}

/** Re-render on every session change (edits landing from any pane). */
export function useSessionChanges(app: WidgetProps['app']): void {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => app.session.on('change', bump), [app]);
}
