// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pomodoroStore, type PomodoroPhase } from '../src/store';

// The phase machine drives every surface (header, widget, chip, sheet) from this
// one module-level singleton, so its transitions are the part most worth pinning
// down. jsdom gives it a real localStorage; fake timers give it a deterministic
// wall clock — the countdown is computed from `Date.now()`, not from tick counts.
describe('pomodoroStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pomodoroStore.onPhaseComplete = null;
    pomodoroStore.setDurations({ focus: 1, shortBreak: 1, longBreak: 2, cycleLength: 2 });
    pomodoroStore.setAutoStart(true, false);
    pomodoroStore.resetCycle();
  });

  afterEach(() => {
    pomodoroStore.onPhaseComplete = null;
    pomodoroStore.reset();
    vi.clearAllTimers();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('seeds the countdown from the configured phase length', () => {
    expect(pomodoroStore.phase).toBe('focus');
    expect(pomodoroStore.state).toBe('idle');
    expect(pomodoroStore.remainingSeconds).toBe(60);
  });

  it('counts down against the wall clock', () => {
    pomodoroStore.start();
    expect(pomodoroStore.state).toBe('running');

    vi.advanceTimersByTime(20_000);
    expect(pomodoroStore.remainingSeconds).toBe(40);

    vi.advanceTimersByTime(20_000);
    expect(pomodoroStore.remainingSeconds).toBe(20);
    expect(pomodoroStore.progress).toBeCloseTo(2 / 3, 5);
  });

  it('records a finished focus block and auto-starts the break', () => {
    const completed: Array<[PomodoroPhase, number]> = [];
    pomodoroStore.onPhaseComplete = (phase, seconds) => completed.push([phase, seconds]);

    pomodoroStore.start();
    vi.advanceTimersByTime(60_000);

    expect(completed).toEqual([['focus', 60]]);
    expect(pomodoroStore.completedFocus).toBe(1);
    // autoStartBreaks is on, so the short break is already running.
    expect(pomodoroStore.phase).toBe('short-break');
    expect(pomodoroStore.state).toBe('running');
    expect(pomodoroStore.remainingSeconds).toBe(60);
  });

  it('waits for the user when auto-start is off', () => {
    pomodoroStore.setAutoStart(false, false);
    pomodoroStore.start();
    vi.advanceTimersByTime(60_000);

    expect(pomodoroStore.state).toBe('completed');
    expect(pomodoroStore.phase).toBe('focus');
    expect(pomodoroStore.upcomingPhase).toBe('short-break');

    // The primary button starts the queued phase rather than repeating focus.
    pomodoroStore.start();
    expect(pomodoroStore.phase).toBe('short-break');
    expect(pomodoroStore.state).toBe('running');
  });

  it('reaches the long break at the end of a cycle, then resets the dots', () => {
    pomodoroStore.setAutoStart(false, false);

    // Focus #1 → short break.
    pomodoroStore.start();
    vi.advanceTimersByTime(60_000);
    expect(pomodoroStore.upcomingPhase).toBe('short-break');
    pomodoroStore.start();
    vi.advanceTimersByTime(60_000);

    // Focus #2 closes the 2-block cycle → long break.
    pomodoroStore.start();
    expect(pomodoroStore.phase).toBe('focus');
    vi.advanceTimersByTime(60_000);
    expect(pomodoroStore.completedFocus).toBe(2);
    expect(pomodoroStore.upcomingPhase).toBe('long-break');

    pomodoroStore.start();
    vi.advanceTimersByTime(120_000);
    // The long break closes the cycle: the dots start over.
    expect(pomodoroStore.completedFocus).toBe(0);
    expect(pomodoroStore.upcomingPhase).toBe('focus');
  });

  it('holds the remainder while paused and resumes from it', () => {
    pomodoroStore.start();
    vi.advanceTimersByTime(15_000);
    pomodoroStore.pause();
    expect(pomodoroStore.remainingSeconds).toBe(45);

    // Wall-clock time passing while paused must not eat into the phase.
    vi.advanceTimersByTime(30_000);
    expect(pomodoroStore.remainingSeconds).toBe(45);

    pomodoroStore.resume();
    vi.advanceTimersByTime(5_000);
    expect(pomodoroStore.remainingSeconds).toBe(40);
  });

  it('skips to the next phase without recording anything', () => {
    const onComplete = vi.fn();
    pomodoroStore.onPhaseComplete = onComplete;

    pomodoroStore.start();
    vi.advanceTimersByTime(10_000);
    pomodoroStore.skip();

    expect(onComplete).not.toHaveBeenCalled();
    expect(pomodoroStore.completedFocus).toBe(0);
    expect(pomodoroStore.phase).toBe('short-break');
    expect(pomodoroStore.state).toBe('idle');
    expect(pomodoroStore.remainingSeconds).toBe(60);
  });

  it('keeps a longer duration change out of a running phase', () => {
    pomodoroStore.start();
    vi.advanceTimersByTime(10_000);
    pomodoroStore.setDurations({ focus: 50 });
    // The running block keeps its own end time; the new length applies next time.
    expect(pomodoroStore.remainingSeconds).toBe(50);

    pomodoroStore.reset();
    expect(pomodoroStore.remainingSeconds).toBe(50 * 60);
  });

  it('notifies subscribers on every change', () => {
    const listener = vi.fn();
    const unsubscribe = pomodoroStore.subscribe(listener);

    pomodoroStore.start();
    vi.advanceTimersByTime(1_000);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    const callsBefore = listener.mock.calls.length;
    vi.advanceTimersByTime(1_000);
    expect(listener.mock.calls.length).toBe(callsBefore);
  });
});
