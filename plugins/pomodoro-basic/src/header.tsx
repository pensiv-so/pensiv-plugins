import * as React from 'react';
import { createPortal } from 'react-dom';
import type { AppHeaderActionProps } from '@pensiv/plugin-sdk';
import { formatClock, usePomodoroStore } from './store';
import { MiniRing, PomodoroControls, phaseColor, phaseLabel, useSyncedSettings } from './controls';
import { STR, tr } from './i18n';

/**
 * The app-header pomodoro button + its popover. Registered via
 * `registerAppHeaderAction({ render })`, it takes the same header slot as the
 * native Timer button and shares {@link pomodoroStore} with every other surface,
 * so starting here updates the floating widget (and vice versa) instantly.
 *
 * The button carries the dial in miniature: the same ring, at 0.9rem, in the
 * phase's colour. The popover is a portal positioned under the trigger and
 * clamped to the viewport, with the app's bounce in/out animation.
 */
export const PomodoroHeaderButton: React.FC<AppHeaderActionProps> = ({ app }) => {
  const store = usePomodoroStore();
  useSyncedSettings(app);

  const [open, setOpen] = React.useState(false);
  // Kept mounted through the exit animation so the popover plays its bounce-out
  // instead of vanishing (native parity).
  const [mounted, setMounted] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout>>();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null);

  const isExpanded = (app.storage.get<string>('menuBarIconMode') ?? 'expanded') === 'expanded';
  const shownPhase = store.state === 'completed' ? store.upcomingPhase : store.phase;
  const color = phaseColor(app, shownPhase);
  const displaySeconds =
    store.state === 'completed' ? store.durationFor(store.upcomingPhase) : store.remainingSeconds;
  const progress = store.state === 'completed' ? 1 : store.progress;

  // Open the popover when a phase ends and nothing auto-started — the user has a
  // decision to make ("start the break?"), so surface it.
  const prevState = React.useRef(store.state);
  React.useEffect(() => {
    if (store.state === 'completed' && prevState.current !== 'completed') setOpen(true);
    prevState.current = store.state;
  }, [store.state]);

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
    // Center under the trigger, then clamp to the viewport so it only shifts when
    // it would otherwise run off-screen. Width falls back to the popover's
    // intrinsic 16rem before the first mount, so there is no measure flash.
    const margin = 8;
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const width = contentRef.current?.offsetWidth || 16 * rootPx;
    const center = rect.left + rect.width / 2;
    const maxLeft = window.innerWidth - margin - width;
    const left = Math.min(Math.max(margin, center - width / 2), Math.max(margin, maxLeft));
    setCoords({ top: rect.bottom + 8, left });
  }, []);

  React.useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

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

  const label = `${tr(app, STR.pomodoro)} · ${phaseLabel(app, shownPhase)} ${formatClock(displaySeconds)}`;

  return (
    <>
      <button
        ref={triggerRef}
        className={`pnsv-pm-header${isExpanded ? '' : ' icon'}`}
        title={label}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {/* Paused reads as "held", not stopped: the ring dims. */}
        <span style={{ display: 'inline-flex', opacity: store.state === 'paused' ? 0.5 : 1 }}>
          <MiniRing progress={progress} color={color} size={isExpanded ? undefined : '1.1rem'} />
        </span>
        {isExpanded ? <span>{formatClock(displaySeconds)}</span> : null}
      </button>

      {mounted &&
        coords &&
        createPortal(
          <div
            ref={contentRef}
            className={`pnsv-pm-pop pnsv-pm-card${open ? '' : ' closing'}`}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: '16rem',
              padding: '0.875rem 0.75rem 0.5rem',
              borderRadius: 'calc(var(--radius) + 0.35rem)',
              background: 'hsl(var(--popover) / 0.9)',
              color: 'hsl(var(--popover-foreground))',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 60,
              fontFamily: 'inherit'
            }}
          >
            <PomodoroControls
              app={app}
              ringSize="9rem"
              timeSize="1.75rem"
              onRequestClose={() => setOpen(false)}
            />
          </div>,
          document.body
        )}
    </>
  );
};
