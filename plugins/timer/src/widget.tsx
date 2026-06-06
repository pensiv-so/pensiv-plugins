import * as React from 'react';
import type { WidgetProps } from '@pensiv/plugin-sdk';
import { TimerControls } from './controls';
import { useTimerStore } from './store';

const formatTimeShort = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/** Clock glyph for the idle chip (matches the native `Clock` mono icon). */
/**
 * Compact tray chip (mobile). Returns *only the inner content* of the host's
 * pill — the live `mm:ss` (always shown: idle = selected/default duration,
 * running = countdown, stopwatch = count-up). The host owns the pill chrome +
 * tap-to-open; visibility is gated by the widget's `chipShouldRender`
 * (`showFloatingWidget`). White + difference blend so it reads on any chip tint.
 */
export const TimerChip: React.FC<WidgetProps> = ({ app }) => {
  const store = useTimerStore();
  const mode = app.storage.get<'timer' | 'stopwatch'>('mode') ?? 'timer';
  const defaultMinutes = app.storage.get<number>('defaultMinutes');

  // Sync durable settings (default minutes, mode) into the run-state singleton,
  // mirroring the native pane chip — so the idle chip shows the *configured*
  // time/mode and the countdown (driven by the shared store) stays in lockstep.
  React.useEffect(() => {
    if (defaultMinutes && store.timerState === 'idle') store.setSelectedMinutes(defaultMinutes);
  }, [defaultMinutes, store]);
  React.useEffect(() => {
    if (store.mode !== mode) store.setMode(mode);
  }, [mode, store]);

  // The time is always visible (idle shows the selected/default duration; running
  // counts down; stopwatch counts up).
  const displayTime =
    mode === 'stopwatch'
      ? formatTimeShort(store.remainingSeconds)
      : store.timerState !== 'idle'
        ? formatTimeShort(store.remainingSeconds)
        : formatTimeShort(store.selectedMinutes * 60);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        color: '#fff',
        mixBlendMode: 'difference'
      }}
    >
      <span style={{ fontSize: '0.875rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {displayTime}
      </span>
    </span>
  );
};

/**
 * Floating timer widget. The host owns the floating chrome (drag, corner snap,
 * stacking) via `FloatingWidget`; this renders only the card body. It shares the
 * {@link timerStore} with the header button, so the widget is just another live
 * view of the same countdown. Non-button areas act as the drag handle; the
 * slider and control rows are marked `data-no-drag` inside {@link TimerControls}.
 */
export const TimerFloatingWidget: React.FC<WidgetProps> = ({ app }) => (
  <div
    style={{
      width: '20rem',
      padding: '0.5rem',
      borderRadius: 'calc(var(--radius) + 0.25rem)', // matches app rounded-xl
      border: '1px solid hsl(var(--border))',
      background: 'hsl(var(--popover) / 0.95)',
      color: 'hsl(var(--popover-foreground))',
      boxShadow: 'var(--shadow-lg)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      fontFamily: 'inherit'
    }}
  >
    <TimerControls app={app} />
  </div>
);
