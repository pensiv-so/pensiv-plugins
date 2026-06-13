import * as React from 'react';
import { createPortal } from 'react-dom';
import type { AppHeaderActionProps } from '@pensiv/plugin-sdk';
import { useTimerStore } from './store';
import { TimerControls } from './controls';

const fmt = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/** Clock glyph whose minute hand sweeps with the countdown (native parity). */
const ClockIcon: React.FC<{ minuteRotation: number }> = ({ minuteRotation }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ width: '1.25rem', height: '1.25rem' }}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="12" x2="12" y2="8" />
    <line
      x1="12"
      y1="12"
      x2="12"
      y2="6"
      transform={`rotate(${minuteRotation} 12 12)`}
      style={{ transition: 'transform 0.3s linear' }}
    />
  </svg>
);

/**
 * The app-header Timer button + its popover. Registered via
 * `registerAppHeaderAction({ render: TimerHeaderButton })`, it occupies the same
 * header slot as the native Timer and shares the {@link timerStore} with the
 * floating widget, so starting in one updates the other instantly.
 */
export const TimerHeaderButton: React.FC<AppHeaderActionProps> = ({ app }) => {
  const store = useTimerStore();
  const [open, setOpen] = React.useState(false);
  // Kept mounted through the exit animation, so the popover plays
  // `popover-bounce-out` on close instead of vanishing instantly (native parity).
  const [mounted, setMounted] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout>>();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null);

  const menuBarIconMode = app.storage.get<string>('menuBarIconMode') ?? 'expanded';
  const isExpanded = menuBarIconMode === 'expanded';
  const isActive = store.timerState === 'running' || store.timerState === 'completed';

  const displayTime =
    store.timerState !== 'idle'
      ? fmt(store.remainingSeconds)
      : fmt((store.dragMinutes !== null ? store.dragMinutes : store.selectedMinutes) * 60);

  const minuteRotation = (() => {
    if (store.timerState === 'idle') return 0;
    const totalMinutes = store.dragMinutes !== null ? store.dragMinutes : store.selectedMinutes;
    const totalSeconds = totalMinutes * 60;
    if (totalSeconds === 0) return 0;
    return ((totalSeconds - store.remainingSeconds) / totalSeconds) * 360;
  })();

  // Open the popover automatically when a countdown completes (native behaviour).
  const prevState = React.useRef(store.timerState);
  React.useEffect(() => {
    if (store.timerState === 'completed' && prevState.current !== 'completed') setOpen(true);
    prevState.current = store.timerState;
  }, [store.timerState]);

  // Mount on open; defer unmount until the close animation (0.25s) finishes.
  React.useEffect(() => {
    if (open) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setMounted(true);
    } else if (mounted) {
      closeTimer.current = setTimeout(() => setMounted(false), 250);
    }
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [open, mounted]);

  const reposition = React.useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Center the popover under the trigger, but clamp it to the viewport so it
    // doesn't spill off-screen now that the Timer sits at the window's right
    // edge (the popover is `translateX(-50%)`, i.e. `left` is its center).
    const margin = 8;
    const halfWidth = (contentRef.current?.offsetWidth ?? 320) / 2;
    const center = rect.left + rect.width / 2;
    const min = margin + halfWidth;
    const max = window.innerWidth - margin - halfWidth;
    const left = max < min ? center : Math.min(Math.max(center, min), max);
    setCoords({ top: rect.bottom + 8, left });
  }, []);

  React.useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  // Close on outside click / Escape; track scroll & resize while open.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (contentRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, reposition]);

  return (
    <>
      <button
        ref={triggerRef}
        className={`pnsv-tm-header${isActive ? ' active' : ''}${isExpanded ? '' : ' icon'}`}
        title="Timer"
        aria-label="Timer"
        aria-pressed={isActive}
        onClick={() => setOpen((v) => !v)}
      >
        {isExpanded ? (
          <span
            className="pnsv-tm-tabnum"
            style={{ fontSize: '0.875rem', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            {displayTime}
          </span>
        ) : (
          <ClockIcon minuteRotation={minuteRotation} />
        )}
      </button>

      {mounted &&
        coords &&
        createPortal(
          <div
            ref={contentRef}
            className={`pnsv-tm-pop${open ? '' : ' closing'}`}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              transform: 'translateX(-50%)',
              width: '20rem',
              padding: '0.5rem',
              borderRadius: '1rem',
              background: 'hsl(var(--popover) / 0.5)',
              color: 'hsl(var(--popover-foreground))',
              border: '1px solid hsl(var(--border))',
              boxShadow: 'var(--shadow-xl)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 60,
              fontFamily: 'inherit'
            }}
          >
            <TimerControls app={app} onRequestClose={() => setOpen(false)} />
          </div>,
          document.body
        )}
    </>
  );
};
