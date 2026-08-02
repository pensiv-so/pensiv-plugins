import * as React from 'react';
import type { WidgetProps } from '@pensiv/plugin-sdk';
import { MiniRing, PomodoroControls, phaseColor, useSyncedSettings } from './controls';
import { formatClock, usePomodoroStore } from './store';

/**
 * Floating widget. The host owns the floating chrome (drag, corner snap,
 * stacking) via `frame: 'floating'`; this renders only the card body, so it is
 * just another live view of the same {@link pomodoroStore}. Non-button areas act
 * as the drag handle — the dial and the button row are marked `data-no-drag`
 * inside {@link PomodoroControls}.
 */
export const PomodoroFloatingWidget: React.FC<WidgetProps> = ({ app }) => (
  <div
    // Card chrome (hairline + top highlight) lives in `.pnsv-pm-card` so the
    // dark-mode ring can key off the host's `.dark` ancestor.
    className="pnsv-pm-card"
    style={{
      width: '16rem',
      padding: '0.875rem 0.75rem 0.5rem',
      borderRadius: 'calc(var(--radius) + 0.35rem)',
      background: 'hsl(var(--popover) / 0.95)',
      color: 'hsl(var(--popover-foreground))',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      fontFamily: 'inherit'
    }}
  >
    <PomodoroControls app={app} ringSize="9rem" timeSize="1.75rem" />
  </div>
);

/**
 * Compact tray chip (mobile). Returns *only the inner content* of the host's
 * pill — the mini ring plus the live `mm:ss`. The host owns the pill chrome and
 * tap-to-open (which opens the sheet).
 */
export const PomodoroChip: React.FC<WidgetProps> = ({ app }) => {
  const store = usePomodoroStore();
  useSyncedSettings(app);

  const shownPhase = store.state === 'completed' ? store.upcomingPhase : store.phase;
  const seconds =
    store.state === 'completed' ? store.durationFor(store.upcomingPhase) : store.remainingSeconds;
  const progress = store.state === 'completed' ? 1 : store.progress;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
      <span style={{ display: 'inline-flex', opacity: store.state === 'paused' ? 0.5 : 1 }}>
        <MiniRing progress={progress} color={phaseColor(app, shownPhase)} />
      </span>
      <span
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: 'hsl(var(--foreground))'
        }}
      >
        {formatClock(seconds)}
      </span>
    </span>
  );
};
