import { useEffect, useReducer } from 'react';

/**
 * Shared timer run-state — a module-level singleton, exactly like the native
 * `timer-store.ts`. Because the plugin's header button, popover and floating
 * widget are bundled together, they all import *this same instance*, so the
 * countdown stays in lockstep across all three surfaces ("switching").
 *
 * It owns only ephemeral run-state (what's counting, how much is left) and
 * persists that to its own `localStorage` key so a refresh resumes mid-countdown.
 * Durable settings (presets, mode, menu-bar style) live in the plugin's synced
 * `app.storage` and are pushed in from the components.
 */
export type TimerState = 'idle' | 'running' | 'paused' | 'completed';
export type TimerMode = 'timer' | 'stopwatch';

const STORAGE_KEY = 'pensiv:plugin:timer:run-state';
const DEFAULT_MINUTES = 30;
const AUTO_RESET_MS = 10_000;

interface PersistedState {
  selectedMinutes: number;
  timerState: TimerState;
  remainingSeconds: number;
}

class TimerStore {
  selectedMinutes = DEFAULT_MINUTES;
  timerState: TimerState = 'idle';
  remainingSeconds = 0;
  dragMinutes: number | null = null;
  mode: TimerMode = 'timer';
  /** Set once by the plugin so completion can play the host's chime. */
  onComplete: (() => void) | null = null;

  private listeners = new Set<() => void>();
  private interval: ReturnType<typeof setInterval> | null = null;
  private autoReset: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const stored = this.load();
    if (stored.selectedMinutes) this.selectedMinutes = stored.selectedMinutes;
    this.timerState = stored.timerState ?? 'idle';
    this.remainingSeconds = stored.remainingSeconds ?? 0;
    if (this.timerState === 'running') this.startInterval();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setSelectedMinutes(minutes: number): void {
    this.selectedMinutes = minutes;
    this.persist();
    this.notify();
  }

  setRemainingSeconds(seconds: number): void {
    this.remainingSeconds = seconds;
    this.persist();
    this.notify();
  }

  setDragMinutes(minutes: number | null): void {
    this.dragMinutes = minutes; // never persisted
    this.notify();
  }

  setMode(mode: TimerMode): void {
    const wasRunning = this.timerState === 'running';
    this.mode = mode;
    if (wasRunning) {
      this.clearInterval();
      this.startInterval();
    }
    this.notify();
  }

  setTimerState(state: TimerState, mode?: TimerMode): void {
    this.timerState = state;
    if (mode !== undefined) this.mode = mode;
    this.clearInterval();
    this.clearAutoReset();
    if (state === 'running') this.startInterval();
    this.persist();
    this.notify();
  }

  private startInterval(): void {
    this.clearInterval();
    if (this.mode === 'stopwatch') {
      this.interval = setInterval(() => this.setRemainingSeconds(this.remainingSeconds + 1), 1000);
      return;
    }
    if (this.remainingSeconds <= 0) return;
    this.interval = setInterval(() => {
      if (this.remainingSeconds <= 1) {
        this.clearInterval();
        this.timerState = 'completed';
        this.remainingSeconds = 0;
        this.persist();
        this.notify();
        this.onComplete?.();
        this.scheduleAutoReset();
      } else {
        this.setRemainingSeconds(this.remainingSeconds - 1);
      }
    }, 1000);
  }

  private clearInterval(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private scheduleAutoReset(): void {
    this.clearAutoReset();
    this.autoReset = setTimeout(() => {
      this.setTimerState('idle');
      this.setRemainingSeconds(0);
    }, AUTO_RESET_MS);
  }

  private clearAutoReset(): void {
    if (this.autoReset) {
      clearTimeout(this.autoReset);
      this.autoReset = null;
    }
  }

  private persist(): void {
    try {
      const data: PersistedState = {
        selectedMinutes: this.selectedMinutes,
        timerState: this.timerState,
        remainingSeconds: this.remainingSeconds
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage may be unavailable; run-state stays in-memory */
    }
  }

  private load(): Partial<PersistedState> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as PersistedState;
    } catch {
      /* ignore corrupt state */
    }
    return {};
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const timerStore = new TimerStore();

/** Subscribe a component to {@link timerStore}; re-renders on every change. */
export function useTimerStore(): TimerStore {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => timerStore.subscribe(forceUpdate), []);
  return timerStore;
}
