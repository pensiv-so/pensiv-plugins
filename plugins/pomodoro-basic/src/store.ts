import { useEffect, useReducer } from 'react';

/**
 * Shared pomodoro run-state — a module-level singleton, the same pattern as the
 * Timer plugin's `store.ts`. The app-header button, its popover, the floating
 * widget, the mobile chip/sheet and the stats pane are bundled together, so they
 * all import *this* instance and stay in lockstep.
 *
 * It owns only ephemeral run-state (which phase is counting, how much is left)
 * and persists that to its own `localStorage` key so a reload resumes mid-phase.
 * Durable settings (durations, auto-start, sound) live in the plugin's
 * `app.storage` and are pushed in from the components via {@link setDurations} /
 * {@link setAutoStart}; completed-session history lives in `stats.ts`.
 *
 * Unlike the Timer, the countdown is **wall-clock driven**: a running phase
 * stores `endsAt` and every tick recomputes the remainder from `Date.now()`. A
 * 25-minute block otherwise drifts badly when the renderer is backgrounded and
 * `setInterval` gets throttled.
 */
export type PomodoroPhase = 'focus' | 'short-break' | 'long-break';
export type PomodoroState = 'idle' | 'running' | 'paused' | 'completed';

export interface PomodoroDurations {
  /** Minutes of a focus block. */
  focus: number;
  shortBreak: number;
  longBreak: number;
  /** Focus blocks between long breaks. */
  cycleLength: number;
}

export const DEFAULT_DURATIONS: PomodoroDurations = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
  cycleLength: 4
};

const STORAGE_KEY = 'pensiv:plugin:pomodoro:run-state';
const TICK_MS = 250;
/**
 * A phase that expired while the app was closed is only completed on the next
 * launch if it expired *recently*. Reopening pensiv a week later must not credit
 * a pomodoro that was never sat through.
 */
const RESUME_GRACE_MS = 5 * 60_000;

interface PersistedState {
  phase: PomodoroPhase;
  state: PomodoroState;
  remainingSeconds: number;
  endsAt: number | null;
  completedFocus: number;
  pendingPhase: PomodoroPhase | null;
}

class PomodoroStore {
  durations: PomodoroDurations = { ...DEFAULT_DURATIONS };
  phase: PomodoroPhase = 'focus';
  state: PomodoroState = 'idle';
  remainingSeconds = DEFAULT_DURATIONS.focus * 60;
  /** Focus blocks finished since the last long break (drives the cycle dots). */
  completedFocus = 0;
  autoStartBreaks = true;
  autoStartFocus = false;

  /** Epoch ms the running phase ends at; `null` unless running. */
  private endsAt: number | null = null;
  /** Which phase `start()` will run next, once a completed phase is acknowledged. */
  private pendingPhase: PomodoroPhase | null = null;

  /**
   * Set once by the plugin (never per-surface) so a finished phase can chime,
   * notify and record itself. `elapsedSeconds` is the phase's full length.
   */
  onPhaseComplete: ((phase: PomodoroPhase, elapsedSeconds: number) => void) | null = null;

  private listeners = new Set<() => void>();
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const stored = this.load();
    if (stored) {
      this.phase = stored.phase ?? 'focus';
      this.state = stored.state ?? 'idle';
      this.remainingSeconds = stored.remainingSeconds ?? this.durationFor(this.phase);
      this.endsAt = stored.endsAt ?? null;
      this.completedFocus = stored.completedFocus ?? 0;
      this.pendingPhase = stored.pendingPhase ?? null;
    }
    if (this.state === 'running') this.resumeAfterLoad();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Seconds one phase lasts, from the live durations. */
  durationFor(phase: PomodoroPhase): number {
    const minutes =
      phase === 'focus'
        ? this.durations.focus
        : phase === 'short-break'
          ? this.durations.shortBreak
          : this.durations.longBreak;
    return Math.max(1, Math.round(minutes)) * 60;
  }

  /** The phase that follows `phase`, given how far into the cycle we are. */
  nextAfter(phase: PomodoroPhase): PomodoroPhase {
    if (phase !== 'focus') return 'focus';
    const cycle = Math.max(1, Math.round(this.durations.cycleLength));
    return this.completedFocus > 0 && this.completedFocus % cycle === 0
      ? 'long-break'
      : 'short-break';
  }

  /** What the primary button will run: the pending phase after a completion, else the current one. */
  get upcomingPhase(): PomodoroPhase {
    return this.state === 'completed'
      ? (this.pendingPhase ?? this.nextAfter(this.phase))
      : this.phase;
  }

  /** 0–1 progress through the current phase (1 when a phase has just ended). */
  get progress(): number {
    if (this.state === 'completed') return 1;
    const total = this.durationFor(this.phase);
    if (total <= 0) return 0;
    return Math.min(1, Math.max(0, (total - this.remainingSeconds) / total));
  }

  /** Push the durable settings in. While idle, re-seeds the visible countdown. */
  setDurations(next: Partial<PomodoroDurations>): void {
    const merged = { ...this.durations, ...next };
    const changed = (Object.keys(merged) as Array<keyof PomodoroDurations>).some(
      (k) => merged[k] !== this.durations[k]
    );
    if (!changed) return;
    this.durations = merged;
    if (this.state === 'idle') this.remainingSeconds = this.durationFor(this.phase);
    this.persist();
    this.notify();
  }

  setAutoStart(breaks: boolean, focus: boolean): void {
    if (this.autoStartBreaks === breaks && this.autoStartFocus === focus) return;
    this.autoStartBreaks = breaks;
    this.autoStartFocus = focus;
    this.notify();
  }

  /** Switch phase by hand (only meaningful while stopped). */
  setPhase(phase: PomodoroPhase): void {
    if (this.state === 'running' || this.state === 'paused') return;
    this.phase = phase;
    this.pendingPhase = null;
    this.state = 'idle';
    this.remainingSeconds = this.durationFor(phase);
    this.persist();
    this.notify();
  }

  /** Start (or start the phase queued by a completion). */
  start(): void {
    if (this.state === 'completed') this.phase = this.upcomingPhase;
    this.pendingPhase = null;
    this.beginRun();
  }

  pause(): void {
    if (this.state !== 'running') return;
    this.remainingSeconds = this.remainingLive();
    this.endsAt = null;
    this.state = 'paused';
    this.stopTick();
    this.persist();
    this.notify();
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.endsAt = Date.now() + this.remainingSeconds * 1000;
    this.state = 'running';
    this.startTick();
    this.persist();
    this.notify();
  }

  /** Start / pause / resume in one call (the command + the primary button). */
  toggle(): void {
    if (this.state === 'running') this.pause();
    else if (this.state === 'paused') this.resume();
    else this.start();
  }

  /** Back to the top of the current phase, stopped. */
  reset(): void {
    this.stopTick();
    this.state = 'idle';
    this.endsAt = null;
    this.pendingPhase = null;
    this.remainingSeconds = this.durationFor(this.phase);
    this.persist();
    this.notify();
  }

  /** Move to the next phase without finishing this one — nothing is recorded. */
  skip(): void {
    this.stopTick();
    const next = this.state === 'completed' ? this.upcomingPhase : this.nextAfter(this.phase);
    if (this.phase === 'long-break') this.completedFocus = 0;
    this.phase = next;
    this.pendingPhase = null;
    this.state = 'idle';
    this.endsAt = null;
    this.remainingSeconds = this.durationFor(next);
    this.persist();
    this.notify();
  }

  /** Back to focus #1 of a fresh cycle. */
  resetCycle(): void {
    this.completedFocus = 0;
    this.phase = 'focus';
    this.reset();
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private beginRun(): void {
    const seconds = this.durationFor(this.phase);
    this.remainingSeconds = seconds;
    this.endsAt = Date.now() + seconds * 1000;
    this.state = 'running';
    this.startTick();
    this.persist();
    this.notify();
  }

  /** Seconds left against the wall clock (so throttled ticks can't drift). */
  private remainingLive(): number {
    if (this.endsAt === null) return this.remainingSeconds;
    return Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000));
  }

  private startTick(): void {
    this.stopTick();
    this.interval = setInterval(() => {
      const left = this.remainingLive();
      if (left <= 0) {
        this.completePhase();
        return;
      }
      if (left !== this.remainingSeconds) {
        this.remainingSeconds = left;
        this.persist();
        this.notify();
      }
    }, TICK_MS);
  }

  private stopTick(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private completePhase(): void {
    this.stopTick();
    const finished = this.phase;
    const elapsed = this.durationFor(finished);
    this.remainingSeconds = 0;
    this.endsAt = null;

    if (finished === 'focus') this.completedFocus += 1;
    const next = this.nextAfter(finished);
    // A long break closes the cycle: the dots reset for the next round.
    if (finished === 'long-break') this.completedFocus = 0;

    const auto = finished === 'focus' ? this.autoStartBreaks : this.autoStartFocus;
    if (auto) {
      this.phase = next;
      this.pendingPhase = null;
      this.beginRun();
    } else {
      this.state = 'completed';
      this.pendingPhase = next;
      this.persist();
      this.notify();
    }

    // Fired last so a handler that reads the store sees the settled state.
    this.onPhaseComplete?.(finished, elapsed);
  }

  /**
   * Restore a countdown that was running when the app closed. Still inside its
   * window → keep counting; expired moments ago → let the first tick complete it
   * (and record it); expired long ago → treat the session as abandoned.
   */
  private resumeAfterLoad(): void {
    if (this.endsAt === null) {
      this.state = 'paused';
      return;
    }
    const overdueMs = Date.now() - this.endsAt;
    if (overdueMs > RESUME_GRACE_MS) {
      this.state = 'idle';
      this.endsAt = null;
      this.pendingPhase = null;
      this.remainingSeconds = this.durationFor(this.phase);
      this.persist();
      return;
    }
    this.remainingSeconds = this.remainingLive();
    this.startTick();
  }

  private persist(): void {
    try {
      const data: PersistedState = {
        phase: this.phase,
        state: this.state,
        remainingSeconds: this.remainingSeconds,
        endsAt: this.endsAt,
        completedFocus: this.completedFocus,
        pendingPhase: this.pendingPhase
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage may be unavailable; run-state stays in-memory */
    }
  }

  private load(): PersistedState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as PersistedState;
    } catch {
      /* ignore corrupt state */
    }
    return null;
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const pomodoroStore = new PomodoroStore();

/** Subscribe a component to {@link pomodoroStore}; re-renders on every change. */
export function usePomodoroStore(): PomodoroStore {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => pomodoroStore.subscribe(forceUpdate), []);
  return pomodoroStore;
}

/** `mm:ss` for a countdown readout. */
export const formatClock = (seconds: number): string => {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};
