// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { timerStore } from '../src/store';

// The timer's run-state machine drives three host surfaces (header, popover,
// floating widget) from this one module-level singleton, so its transitions are
// the part most worth pinning down. jsdom gives it a real localStorage + timers;
// fake timers make the countdown deterministic.
describe('timerStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    timerStore.onComplete = null;
    timerStore.setMode('timer');
    timerStore.setTimerState('idle');
    timerStore.setRemainingSeconds(0);
  });

  afterEach(() => {
    timerStore.setTimerState('idle');
    vi.clearAllTimers();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('counts a timer down one second at a time', () => {
    timerStore.setRemainingSeconds(3);
    timerStore.setTimerState('running', 'timer');

    vi.advanceTimersByTime(1000);
    expect(timerStore.remainingSeconds).toBe(2);

    vi.advanceTimersByTime(1000);
    expect(timerStore.remainingSeconds).toBe(1);
  });

  it('completes at zero, fires onComplete, then auto-resets to idle', () => {
    const onComplete = vi.fn();
    timerStore.onComplete = onComplete;
    timerStore.setRemainingSeconds(2);
    timerStore.setTimerState('running', 'timer');

    vi.advanceTimersByTime(2000);
    expect(timerStore.timerState).toBe('completed');
    expect(timerStore.remainingSeconds).toBe(0);
    expect(onComplete).toHaveBeenCalledTimes(1);

    // AUTO_RESET_MS later it returns to idle on its own.
    vi.advanceTimersByTime(10_000);
    expect(timerStore.timerState).toBe('idle');
  });

  it('counts up in stopwatch mode', () => {
    timerStore.setMode('stopwatch');
    timerStore.setRemainingSeconds(0);
    timerStore.setTimerState('running', 'stopwatch');

    vi.advanceTimersByTime(3000);
    expect(timerStore.remainingSeconds).toBe(3);
  });

  it('notifies subscribers on change and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = timerStore.subscribe(listener);

    timerStore.setRemainingSeconds(42);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    listener.mockClear();
    timerStore.setRemainingSeconds(7);
    expect(listener).not.toHaveBeenCalled();
  });
});
