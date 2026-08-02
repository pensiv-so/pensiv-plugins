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

/** Today's totals, guarded against an unavailable session — render-safe. */
export function todaySafe(app: WidgetProps['app']): SessionTotals {
  try {
    return app.session.today();
  } catch {
    return ZERO;
  }
}

/** Live active-writing-time, re-read on every host tick. */
export function useActiveMs(app: WidgetProps['app']): { ms: number; writing: boolean } {
  const [ms, setMs] = React.useState(() => app.session.activeMs());
  const [writing, setWriting] = React.useState(false);

  React.useEffect(() => {
    const read = () => setMs(app.session.activeMs());
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
