import * as React from 'react';
import type { HostApi } from '@pensiv/plugin-sdk';
import {
  DEFAULT_FOCUS_COLOR,
  DEFAULT_LONG_BREAK_COLOR,
  DEFAULT_SHORT_BREAK_COLOR,
  readSettings
} from './settings';
import { formatClock, usePomodoroStore, type PomodoroPhase } from './store';
import { STR, tr } from './i18n';
import { Icon, Pause, Play, RotateCcw, Settings, SkipForward } from './icons';

/**
 * The pomodoro's body: a tick ring with the time inside, the cycle dots and the
 * phase badge under it, then one row of ghost controls. The header popover, the
 * floating widget and the phone sheet all render this same component, so every
 * surface is a view of one {@link pomodoroStore}.
 *
 * Colour is per phase and user-chosen (`focusColor` / `shortBreakColor` /
 * `longBreakColor`), and it is only ever used as an accent: the lit ticks, the
 * badge, the header ring. The card itself stays on the app's neutral popover.
 */

/** The colour the user picked for a phase, falling back to the app's chart hues. */
export const phaseColor = (app: HostApi, phase: PomodoroPhase): string => {
  if (phase === 'focus') return app.storage.get<string>('focusColor') ?? DEFAULT_FOCUS_COLOR;
  if (phase === 'short-break') {
    return app.storage.get<string>('shortBreakColor') ?? DEFAULT_SHORT_BREAK_COLOR;
  }
  return app.storage.get<string>('longBreakColor') ?? DEFAULT_LONG_BREAK_COLOR;
};

export const phaseLabel = (app: HostApi, phase: PomodoroPhase): string =>
  tr(app, phase === 'focus' ? STR.focus : phase === 'short-break' ? STR.shortBreak : STR.longBreak);

/**
 * Push durable settings into the run-state singleton. Every surface calls it, so
 * whichever one is mounted keeps the store honest — the store stays the single
 * source of truth the surfaces render from.
 */
export function useSyncedSettings(app: HostApi): void {
  const store = usePomodoroStore();
  const s = readSettings((key) => app.storage.get(key));
  React.useEffect(() => {
    store.setDurations({
      focus: s.focus,
      shortBreak: s.shortBreak,
      longBreak: s.longBreak,
      cycleLength: s.cycleLength
    });
  }, [store, s.focus, s.shortBreak, s.longBreak, s.cycleLength]);
  React.useEffect(() => {
    store.setAutoStart(s.autoStartBreaks, s.autoStartFocus);
  }, [store, s.autoStartBreaks, s.autoStartFocus]);
}

/** Marks on the dial — one per minute of a 60-minute clock face. */
const TICKS = 60;

/**
 * The dial's marks: 60 lines from 12 o'clock clockwise, lit in the phase's colour
 * as the block elapses. It is the native timer's tick strip rolled into a circle,
 * so progress reads at a glance and the ticks stay countable.
 *
 * This was a masked `repeating-conic-gradient` first — one element instead of
 * sixty — but a conic gradient's colour stops are hard edges the compositor does
 * not antialias, so every tick came out with visibly stepped sides. SVG strokes
 * antialias and take round caps, and sixty `<line>`s is the same order of DOM the
 * native timer strip already pays for. Memoized on `(lit, color)` so a per-second
 * countdown only re-renders them when a tick actually changes.
 */
const RingTicks = React.memo(function RingTicks({ lit, color }: { lit: number; color: string }) {
  return (
    <svg
      className="pnsv-pm-ticks"
      viewBox="0 0 100 100"
      aria-hidden="true"
      shapeRendering="geometricPrecision"
    >
      {Array.from({ length: TICKS }).map((_, i) => (
        <line
          key={i}
          x1="50"
          y1="4"
          x2="50"
          y2="11"
          strokeWidth={1.6}
          strokeLinecap="round"
          stroke={i < lit ? color : 'hsl(var(--muted-foreground) / 0.35)'}
          transform={`rotate(${i * (360 / TICKS)} 50 50)`}
        />
      ))}
    </svg>
  );
});

export const TickRing: React.FC<{
  size: string;
  progress: number;
  color: string;
  dimmed?: boolean;
  children?: React.ReactNode;
}> = ({ size, progress, color, dimmed, children }) => {
  const clamped = Math.min(1, Math.max(0, progress));
  // Round rather than floor, so the first tick lights as soon as a block starts.
  const lit = clamped <= 0 ? 0 : Math.max(1, Math.round(clamped * TICKS));
  return (
    <span
      className="pnsv-pm-ring"
      style={{ width: size, height: size, opacity: dimmed ? 0.55 : 1 }}
    >
      <RingTicks lit={lit} color={color} />
      {children != null ? <span className="pnsv-pm-face">{children}</span> : null}
    </span>
  );
};

/**
 * The dial in miniature, for the header button and the phone chip. At 0.9rem the
 * individual ticks would turn to mush, so it degrades to a single arc — drawn as
 * a dash-offset stroke, which antialiases and animates cleanly.
 */
export const MiniRing: React.FC<{ progress: number; color: string; size?: string }> = ({
  progress,
  color,
  size
}) => {
  const r = 8;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <svg
      className="pnsv-pm-mini"
      viewBox="0 0 20 20"
      aria-hidden="true"
      style={size ? { width: size, height: size } : undefined}
    >
      <g transform="rotate(-90 10 10)">
        <circle
          cx="10"
          cy="10"
          r={r}
          fill="none"
          stroke="hsl(var(--muted-foreground) / 0.3)"
          strokeWidth={3}
        />
        <circle
          className="arc"
          cx="10"
          cy="10"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
        />
      </g>
    </svg>
  );
};

/** `● ● ○ ○` — focus blocks finished in this cycle. */
export const CycleDots: React.FC<{ done: number; total: number; color: string }> = ({
  done,
  total,
  color
}) => (
  <span className="pnsv-pm-dots" aria-hidden="true">
    {Array.from({ length: Math.max(1, total) }).map((_, i) => (
      <i key={i} style={i < done ? { background: color } : undefined} />
    ))}
  </span>
);

/**
 * The badge tint. Computed here rather than with `color-mix()`: the setting is a
 * plain `#rrggbb` from the host's colour field, and an unsupported `color-mix`
 * (older iOS WebViews) is an *invalid* declaration — the background would drop
 * out silently instead of degrading. Non-hex values fall back to the colour
 * itself at full strength, which is still legible.
 */
export function tint(color: string, alpha: number): string {
  const hex = color.trim().replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return color;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Phase badge — the shape the app's MCP settings tab uses for its status pill
 * (`rounded-md`, accent at 15%, same accent for the label). It replaced a line of
 * micro-caps inside the ring, which was too small to read at a glance.
 */
export const PhaseBadge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span className="pnsv-pm-badge" style={{ color, background: tint(color, 0.15) }}>
    {label}
  </span>
);

/** Press-and-hold on the dial resets the phase; a plain click starts / pauses it. */
function useHoldToReset(onTap: () => void, onHold: () => void) {
  const timer = React.useRef<ReturnType<typeof setTimeout>>();
  const held = React.useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = undefined;
  };

  React.useEffect(() => clear, []);

  return {
    onPointerDown: () => {
      held.current = false;
      clear();
      timer.current = setTimeout(() => {
        held.current = true;
        onHold();
      }, 550);
    },
    onPointerUp: () => {
      clear();
      if (!held.current) onTap();
      held.current = false;
    },
    onPointerLeave: () => {
      clear();
      held.current = false;
    },
    onPointerCancel: () => {
      clear();
      held.current = false;
    }
  };
}

export interface ControlsProps {
  app: HostApi;
  /** Dial diameter. Bigger on the phone sheet than in the header popover. */
  ringSize?: string;
  /** Font size of the readout inside the dial. */
  timeSize?: string;
  /** Close the surrounding popover (used by the settings action). */
  onRequestClose?: () => void;
}

export const PomodoroControls: React.FC<ControlsProps> = ({
  app,
  ringSize = '9rem',
  timeSize = '1.75rem',
  onRequestClose
}) => {
  const store = usePomodoroStore();
  useSyncedSettings(app);

  // While a phase is queued (auto-start off) the card already shows the *next*
  // phase, so the user reads what pressing the button will start.
  const shownPhase = store.state === 'completed' ? store.upcomingPhase : store.phase;
  const color = phaseColor(app, shownPhase);
  const seconds =
    store.state === 'completed' ? store.durationFor(store.upcomingPhase) : store.remainingSeconds;
  const running = store.state === 'running';

  const badgeLabel = store.state === 'paused' ? tr(app, STR.paused) : phaseLabel(app, shownPhase);

  const primaryLabel = running
    ? tr(app, STR.pause)
    : store.state === 'paused'
      ? tr(app, STR.resume)
      : store.state === 'completed'
        ? tr(app, STR.startNext)
        : tr(app, STR.start);

  const hold = useHoldToReset(
    () => store.toggle(),
    () => store.reset()
  );

  return (
    <div className="pnsv-pm-body" data-no-drag>
      <button
        type="button"
        className="pnsv-pm-dial"
        title={`${badgeLabel} · ${tr(app, STR.holdToReset)}`}
        aria-label={`${primaryLabel} · ${badgeLabel}`}
        {...hold}
      >
        <TickRing
          size={ringSize}
          progress={store.state === 'completed' ? 0 : store.progress}
          color={color}
          dimmed={store.state === 'paused'}
        >
          <span className="pnsv-pm-num" style={{ fontSize: timeSize }}>
            {formatClock(seconds)}
          </span>
        </TickRing>
      </button>

      <CycleDots
        done={store.completedFocus}
        total={store.durations.cycleLength}
        color={phaseColor(app, 'focus')}
      />

      <PhaseBadge label={badgeLabel} color={color} />

      <div className="pnsv-pm-actions">
        <button className="pnsv-pm-btn" onClick={() => store.toggle()}>
          {primaryLabel}
        </button>
        <button
          className="pnsv-pm-btn icon"
          title={tr(app, STR.skip)}
          aria-label={tr(app, STR.skip)}
          onClick={() => store.skip()}
        >
          <Icon>{SkipForward}</Icon>
        </button>
        <span className="pnsv-pm-spacer" />
        <button
          className="pnsv-pm-btn icon"
          title={tr(app, STR.reset)}
          aria-label={tr(app, STR.reset)}
          onClick={() => store.reset()}
        >
          <Icon>{RotateCcw}</Icon>
        </button>
        <button
          className="pnsv-pm-btn icon"
          title={tr(app, STR.settings)}
          aria-label={tr(app, STR.settings)}
          onClick={() => {
            onRequestClose?.();
            app.ui.openSettings();
          }}
        >
          <Icon>{Settings}</Icon>
        </button>
      </div>
    </div>
  );
};

/** Play / pause glyph for the compact surfaces. */
export const TransportGlyph: React.FC<{ running: boolean; size?: string }> = ({
  running,
  size = '0.875rem'
}) => <Icon size={size}>{running ? Pause : Play}</Icon>;
