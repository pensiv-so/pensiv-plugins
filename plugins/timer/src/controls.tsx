import * as React from 'react';
import type { HostApi } from '@pensiv/plugin-sdk';
import { timerStore, useTimerStore, type TimerMode } from './store';
import { STR, presetLabel, tr } from './i18n';

const DEFAULT_PRESETS = [5, 30, 50];

const fmt = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

interface ControlsProps {
  app: HostApi;
  /** Close the surrounding popover (settings / stop in the header form). */
  onRequestClose?: () => void;
}

/**
 * The timer's interactive body — slider, presets, transport buttons and the big
 * time readout. A faithful port of the native `TimerPopover` / floating-widget
 * content, driven by the shared {@link timerStore} and the plugin's `app.storage`
 * settings. Both the header popover and the floating widget render this same
 * component, so all surfaces share state and behaviour.
 */
export const TimerControls: React.FC<ControlsProps> = ({ app, onRequestClose }) => {
  const store = useTimerStore();
  const mode = (app.storage.get<TimerMode>('mode') ?? 'timer') as TimerMode;
  const presets = app.storage.get<number[]>('presets') ?? DEFAULT_PRESETS;
  const defaultMinutes = app.storage.get<number>('defaultMinutes');

  // Seed selected minutes from the saved default while idle.
  React.useEffect(() => {
    if (defaultMinutes && store.timerState === 'idle') {
      store.setSelectedMinutes(defaultMinutes);
    }
  }, [defaultMinutes]);

  // Keep the run-state's mode in sync with the persisted setting.
  React.useEffect(() => {
    if (store.mode !== mode) store.setMode(mode);
  }, [mode]);

  const saveDefaultMinutes = (minutes: number) => {
    app.storage.set('defaultMinutes', minutes);
  };

  const handleStart = () => {
    if (mode === 'stopwatch') {
      store.setRemainingSeconds(0);
      store.setTimerState('running', mode);
      return;
    }
    const minutes = store.selectedMinutes;
    saveDefaultMinutes(minutes);
    store.setRemainingSeconds(minutes * 60);
    store.setTimerState('running', mode);
  };

  const handlePause = () => store.setTimerState('paused');
  const handleResume = () => store.setTimerState('running');
  const handleCancel = () => {
    store.setTimerState('idle');
    store.setRemainingSeconds(0);
  };
  const handleRestart = () => {
    if (mode === 'stopwatch') {
      store.setRemainingSeconds(0);
      store.setTimerState('running', mode);
    } else {
      store.setRemainingSeconds(store.selectedMinutes * 60);
      store.setTimerState('running', mode);
    }
  };
  const handleStop = () => {
    store.setTimerState('idle');
    store.setRemainingSeconds(0);
    onRequestClose?.();
  };

  const handlePresetClick = (minutes: number) => {
    if (mode === 'stopwatch') return;
    store.setSelectedMinutes(minutes);
    if (store.timerState === 'idle' || store.timerState === 'completed') {
      saveDefaultMinutes(minutes);
      store.setRemainingSeconds(minutes * 60);
      store.setTimerState('running', mode);
    }
  };

  const handleModeToggle = () => {
    const newMode: TimerMode = mode === 'timer' ? 'stopwatch' : 'timer';
    if (store.timerState !== 'idle') {
      store.setTimerState('idle', newMode);
      store.setRemainingSeconds(0);
    } else {
      store.setMode(newMode);
    }
    app.storage.set('mode', newMode);
  };

  // ---- Slider drag (1–120 min) ---------------------------------------------
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragPosition, setDragPosition] = React.useState<number | null>(null);
  const sliderRef = React.useRef<HTMLDivElement>(null);
  const rafRef = React.useRef<number | null>(null);

  const applyMinutes = React.useCallback(
    (minutes: number) => {
      if (mode === 'stopwatch') return;
      store.setSelectedMinutes(minutes);
      if (store.timerState === 'idle') store.setRemainingSeconds(minutes * 60);
    },
    [mode]
  );

  const valueFromX = React.useCallback((clientX: number) => {
    if (!sliderRef.current) {
      return {
        minutes: timerStore.selectedMinutes,
        percentage: (timerStore.selectedMinutes - 1) / 119
      };
    }
    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const minutes = Math.round(percentage * 119) + 1; // 1–120
    return { minutes, percentage };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode === 'stopwatch' || store.timerState !== 'idle') return;
    setIsDragging(true);
    const { minutes, percentage } = valueFromX(e.clientX);
    store.setDragMinutes(minutes);
    setDragPosition(percentage);
    applyMinutes(minutes);
  };

  React.useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const { minutes, percentage } = valueFromX(e.clientX);
        store.setDragMinutes(minutes);
        setDragPosition(percentage);
        applyMinutes(minutes);
      });
    };
    const onUp = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (timerStore.dragMinutes !== null) {
        const minutes = timerStore.dragMinutes;
        applyMinutes(minutes);
        saveDefaultMinutes(minutes);
      }
      setIsDragging(false);
      store.setDragMinutes(null);
      setDragPosition(null);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isDragging, valueFromX, applyMinutes]);

  // ---- Derived display ------------------------------------------------------
  const displayTime =
    mode === 'stopwatch'
      ? fmt(store.remainingSeconds)
      : store.timerState !== 'idle'
        ? fmt(store.remainingSeconds)
        : fmt((isDragging && store.dragMinutes !== null ? store.dragMinutes : store.selectedMinutes) * 60);

  const isTimerActive = store.timerState === 'running' || store.timerState === 'paused';
  const isCompleted = mode === 'timer' && store.timerState === 'completed';

  const thumbLeft = (() => {
    if (mode === 'stopwatch') {
      return Math.max(0, Math.min(100, (((store.remainingSeconds / 60) % 120) / 120) * 100));
    }
    if (isDragging && dragPosition !== null) return dragPosition * 100;
    if (store.timerState === 'running' || store.timerState === 'paused') {
      return Math.max(0, Math.min(100, ((store.remainingSeconds / 60 - 1) / 119) * 100));
    }
    return Math.max(0, Math.min(100, ((store.selectedMinutes - 1) / 119) * 100));
  })();

  const running = store.timerState === 'running';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Time slider */}
      <div style={{ padding: '0.25rem' }}>
        <div
          ref={sliderRef}
          data-no-drag
          onMouseDown={handleMouseDown}
          style={{
            position: 'relative',
            height: '2rem',
            width: '100%',
            userSelect: 'none',
            cursor: isCompleted ? 'not-allowed' : 'pointer',
            opacity: isCompleted ? 0.5 : isDragging ? 0.6 : 1
          }}
        >
          {/* Background segments */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
            {Array.from({ length: 120 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: '1.75rem',
                  width: `${100 / 120}%`,
                  borderRight: '1px solid hsl(var(--muted-foreground) / 0.2)'
                }}
              />
            ))}
          </div>
          {/* Thumb */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: `${thumbLeft}%`,
              transform: 'translate(-50%, -50%)',
              width: '0.125rem',
              height: isDragging ? '2.5rem' : '1.75rem',
              background: running ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
              transition: isDragging ? 'none' : 'height 0.2s, background-color 0.2s'
            }}
          />
        </div>
      </div>

      {/* Preset / transport row (hidden when completed) */}
      {!isCompleted && (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.25rem' }} data-no-drag>
          {/* Presets stay mounted in every mode so toggling timer↔stopwatch
              cross-fades (blur) instead of unmounting instantly — they're just
              driven to the hidden state unless we're an idle timer. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              transition: 'all 0.4s cubic-bezier(.47,1.14,.41,1)',
              ...(mode === 'timer' && store.timerState === 'idle'
                ? { transform: 'scale(1)', opacity: 1, filter: 'blur(0)' }
                : {
                    position: 'absolute',
                    pointerEvents: 'none',
                    transform: 'scale(0.9)',
                    opacity: 0,
                    filter: 'blur(4px)'
                  })
            }}
          >
            {presets.map((preset, index) => (
              <button
                key={`preset-${preset}-${index}`}
                className="pnsv-tm-btn"
                onClick={() => handlePresetClick(preset)}
              >
                {presetLabel(app, preset)}
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              transition: 'all 0.4s cubic-bezier(.47,1.14,.41,1)',
              ...(isTimerActive
                ? { transform: 'scale(1)', opacity: 1, filter: 'blur(0)' }
                : {
                    position: 'absolute',
                    pointerEvents: 'none',
                    transform: 'scale(0.9)',
                    opacity: 0,
                    filter: 'blur(4px)'
                  })
            }}
          >
            <button className="pnsv-tm-btn" onClick={handleCancel}>
              {tr(app, STR.cancel)}
            </button>
            <button className="pnsv-tm-btn" onClick={handleRestart}>
              {tr(app, STR.restart)}
            </button>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button
              className="pnsv-tm-btn"
              onClick={handleModeToggle}
              title={tr(app, mode === 'timer' ? STR.switchToStopwatch : STR.switchToTimer)}
            >
              {tr(app, mode === 'timer' ? STR.timer : STR.stopwatch)}
            </button>
            <button
              className="pnsv-tm-btn"
              onClick={() => {
                onRequestClose?.();
                app.ui.openSettings();
              }}
            >
              {tr(app, STR.settings)}
            </button>
          </div>
        </div>
      )}

      {/* Display + primary action */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        {isCompleted ? (
          <button className="pnsv-tm-btn" onClick={handleStop}>
            {tr(app, STR.stop)}
          </button>
        ) : store.timerState === 'idle' ? (
          <button className="pnsv-tm-btn" onClick={handleStart}>
            {tr(app, STR.start)}
          </button>
        ) : (
          <button className="pnsv-tm-btn" onClick={running ? handlePause : handleResume}>
            {tr(app, running ? STR.pause : STR.resume)}
          </button>
        )}
        <div
          className="pnsv-tm-tabnum"
          style={{ padding: '0.25rem', fontSize: '1.875rem', fontWeight: 400, letterSpacing: '-0.04em', lineHeight: 1 }}
        >
          {displayTime}
        </div>
      </div>
    </div>
  );
};
