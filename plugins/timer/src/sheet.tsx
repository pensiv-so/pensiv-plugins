import * as React from 'react';
import type { WidgetProps } from '@pensiv/plugin-sdk';
import {
  SheetActionRow,
  SheetButton,
  SheetGroup,
  SheetSeparator,
  SheetStack
} from '@pensiv/plugin-ui';
import { useTimerStore } from './store';
import { STR, tr, presetLabel } from './i18n';

/**
 * Mobile **bottom-sheet body** for the timer (phone tray). Composed from the host
 * UI kit (`@pensiv/plugin-ui`) so it matches every other plugin sheet, and
 * mirrors the native `ProjectPaneTimerBottomSheet`: a summary card with a
 * draggable minute slider, preset/action rows, and a full-width primary action.
 * Wired to the plugin's own `timerStore` + `app.storage`.
 */
const fmt = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/** A row glyph; inherits the kit's row icon color via `currentColor`. */
const Icon: React.FC<{ d: React.ReactNode }> = ({ d }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="1.15rem"
    height="1.15rem"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    {d}
  </svg>
);
const ClockGlyph = (
  <>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </>
);
const XGlyph = (
  <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </>
);
const RotateGlyph = (
  <>
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </>
);
const CogGlyph = (
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </>
);

export const TimerSheet: React.FC<WidgetProps> = ({ app }) => {
  const store = useTimerStore();
  const mode = app.storage.get<'timer' | 'stopwatch'>('mode') ?? 'timer';
  const presets = app.storage.get<number[]>('presets') ?? [5, 30, 50];

  const sliderRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragPos, setDragPos] = React.useState<number | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const setDefaultMinutes = (minutes: number) => app.storage.set('defaultMinutes', minutes);

  const handleSliderChange = (minutes: number) => {
    if (mode === 'stopwatch') return;
    store.setSelectedMinutes(minutes);
    if (store.timerState === 'idle') store.setRemainingSeconds(minutes * 60);
  };

  const valueFromX = (clientX: number): { minutes: number; pct: number } => {
    const el = sliderRef.current;
    if (!el) return { minutes: store.selectedMinutes, pct: (store.selectedMinutes - 1) / 119 };
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return { minutes: Math.round(pct * 119) + 1, pct };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode === 'stopwatch' || store.timerState !== 'idle') return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    const { minutes, pct } = valueFromX(e.clientX);
    store.setDragMinutes(minutes);
    setDragPos(pct);
    handleSliderChange(minutes);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const { minutes, pct } = valueFromX(e.clientX);
      store.setDragMinutes(minutes);
      setDragPos(pct);
      handleSliderChange(minutes);
    });
  };
  const endDrag = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const final = store.dragMinutes;
    if (final !== null) {
      handleSliderChange(final);
      setDefaultMinutes(final);
    }
    setIsDragging(false);
    store.setDragMinutes(null);
    setDragPos(null);
  };

  const start = () => {
    if (mode === 'stopwatch') {
      store.setRemainingSeconds(0);
      store.setTimerState('running', mode);
      return;
    }
    const minutes = store.selectedMinutes;
    setDefaultMinutes(minutes);
    store.setRemainingSeconds(minutes * 60);
    store.setTimerState('running', mode);
  };
  const presetClick = (minutes: number) => {
    if (mode === 'stopwatch') return;
    store.setSelectedMinutes(minutes);
    if (store.timerState === 'idle' || store.timerState === 'completed') {
      setDefaultMinutes(minutes);
      store.setRemainingSeconds(minutes * 60);
      store.setTimerState('running', mode);
    }
  };
  const toggleMode = () => {
    const next = mode === 'timer' ? 'stopwatch' : 'timer';
    if (store.timerState !== 'idle') {
      store.setTimerState('idle', next);
      store.setRemainingSeconds(0);
    } else {
      store.setMode(next);
    }
    app.storage.set('mode', next);
  };

  const displayTime =
    mode === 'stopwatch'
      ? fmt(store.remainingSeconds)
      : store.timerState !== 'idle'
        ? fmt(store.remainingSeconds)
        : fmt((isDragging && store.dragMinutes !== null ? store.dragMinutes : store.selectedMinutes) * 60);

  const isActive = store.timerState === 'running' || store.timerState === 'paused';
  const isCompleted = mode === 'timer' && store.timerState === 'completed';

  const thumbLeft =
    isDragging && dragPos !== null
      ? `${dragPos * 100}%`
      : isActive
        ? `${Math.max(0, Math.min(100, ((store.remainingSeconds / 60 - 1) / 119) * 100))}%`
        : `${Math.max(0, Math.min(100, ((store.selectedMinutes - 1) / 119) * 100))}%`;

  return (
    <SheetStack>
      <SheetGroup>
        <p
          style={{
            padding: '0.5rem 0',
            textAlign: 'center',
            fontSize: '1.125rem',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
            color: 'hsl(var(--foreground))',
            margin: 0
          }}
        >
          {displayTime}
        </p>

        {mode === 'timer' ? (
          <div style={{ margin: '0 0.25rem 1rem' }}>
            <div
              ref={sliderRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{
                position: 'relative',
                height: '3rem',
                width: '100%',
                touchAction: 'none',
                userSelect: 'none',
                cursor: isCompleted ? 'not-allowed' : 'pointer',
                opacity: isCompleted ? 0.5 : store.timerState !== 'idle' ? 0.6 : 1,
                pointerEvents: store.timerState !== 'idle' ? 'none' : 'auto'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  overflow: 'hidden'
                }}
              >
                {Array.from({ length: 120 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: '2rem',
                      borderRight: '1px solid hsl(var(--border) / 0.6)',
                      width: `${100 / 120}%`
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  zIndex: 1,
                  width: '2px',
                  height: isDragging ? '2.5rem' : '2rem',
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '9999px',
                  background:
                    store.timerState === 'running'
                      ? 'hsl(var(--destructive))'
                      : 'hsl(var(--primary))',
                  left: thumbLeft,
                  transition: isDragging ? undefined : 'height 200ms'
                }}
              />
            </div>
          </div>
        ) : null}
      </SheetGroup>

      {!isCompleted && mode === 'timer' && store.timerState === 'idle' ? (
        <SheetGroup>
          {presets.map((preset, i) => (
            <React.Fragment key={`${preset}-${i}`}>
              {i > 0 ? <SheetSeparator /> : null}
              <SheetActionRow
                icon={<Icon d={ClockGlyph} />}
                label={presetLabel(app, preset)}
                onClick={() => presetClick(preset)}
              />
            </React.Fragment>
          ))}
        </SheetGroup>
      ) : null}

      {!isCompleted && isActive ? (
        <SheetGroup>
          <SheetActionRow
            icon={<Icon d={XGlyph} />}
            label={tr(app, STR.cancel)}
            onClick={() => {
              store.setTimerState('idle');
              store.setRemainingSeconds(0);
            }}
          />
          <SheetSeparator />
          <SheetActionRow
            icon={<Icon d={RotateGlyph} />}
            label={tr(app, STR.restart)}
            onClick={() => {
              if (mode === 'stopwatch') store.setRemainingSeconds(0);
              else store.setRemainingSeconds(store.selectedMinutes * 60);
              store.setTimerState('running', mode);
            }}
          />
        </SheetGroup>
      ) : null}

      <SheetGroup>
        <SheetActionRow
          label={mode === 'timer' ? tr(app, STR.switchToStopwatch) : tr(app, STR.switchToTimer)}
          onClick={toggleMode}
        />
        <SheetSeparator />
        <SheetActionRow
          icon={<Icon d={CogGlyph} />}
          label={tr(app, STR.settings)}
          onClick={() => app.ui.openSettings()}
        />
      </SheetGroup>

      {isCompleted ? (
        <SheetButton
          variant="outline"
          label={tr(app, STR.stop)}
          onClick={() => {
            store.setTimerState('idle');
            store.setRemainingSeconds(0);
          }}
        />
      ) : store.timerState === 'idle' ? (
        <SheetButton variant="primary" label={tr(app, STR.start)} onClick={start} />
      ) : (
        <SheetButton
          variant="outline"
          label={store.timerState === 'running' ? tr(app, STR.pause) : tr(app, STR.resume)}
          onClick={() => store.setTimerState(store.timerState === 'running' ? 'paused' : 'running')}
        />
      )}
    </SheetStack>
  );
};
