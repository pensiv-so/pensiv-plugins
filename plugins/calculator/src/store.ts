import { useEffect, useReducer } from 'react';
import { applyKey, initialState, type CalcKey, type CalcState } from './engine';

/**
 * Shared calculator state — a module-level singleton, the pattern the Timer
 * plugin documents. The floating card, the header sheet and the phone chip are
 * separate mounts of separate components; only a module singleton keeps them
 * showing the same number (start a sum in the header, finish it in the widget).
 *
 * It holds ephemeral run-state, so it persists *itself* to one `localStorage`
 * key rather than to `app.storage`: a half-typed sum is on-device, high
 * frequency, and not a setting anyone would want synced to their phone.
 */
const STORAGE_KEY = 'pensiv:plugin:calculator:state';
/** Kept short on purpose — the tape is a glance backwards, not a ledger. */
const MAX_TAPE = 8;

/** One finished calculation, newest first. */
export interface TapeEntry {
  expression: string;
  result: string;
}

interface Persisted {
  state: CalcState;
  tape: TapeEntry[];
}

class CalculatorStore {
  state: CalcState = initialState();
  tape: TapeEntry[] = [];

  private listeners = new Set<() => void>();

  constructor() {
    const stored = this.load();
    if (stored.state) this.state = { ...initialState(), ...stored.state };
    if (Array.isArray(stored.tape)) this.tape = stored.tape.slice(0, MAX_TAPE);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  press(key: CalcKey): void {
    const next = applyKey(this.state, key);
    if (next === this.state) return;
    // A closed `=` is the only thing worth remembering; operator chaining would
    // otherwise fill the tape with every intermediate step.
    if (key.type === 'equals' && next.trail.endsWith('=') && !next.error) {
      this.tape = [{ expression: next.trail, result: next.entry }, ...this.tape].slice(0, MAX_TAPE);
    }
    this.state = next;
    this.persist();
    this.notify();
  }

  /** Drop a tape row back onto the display, so an old result can be reused. */
  recall(entry: TapeEntry): void {
    this.state = { ...this.state, entry: entry.result, replace: true, error: false, trail: '' };
    this.persist();
    this.notify();
  }

  clearTape(): void {
    this.tape = [];
    this.persist();
    this.notify();
  }

  private persist(): void {
    try {
      const data: Persisted = { state: this.state, tape: this.tape };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage may be unavailable; the calculator stays in-memory */
    }
  }

  private load(): Partial<Persisted> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Persisted;
    } catch {
      /* ignore corrupt state */
    }
    return {};
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const calculatorStore = new CalculatorStore();

/** Subscribe a component to {@link calculatorStore}; re-renders on every change. */
export function useCalculatorStore(): CalculatorStore {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => calculatorStore.subscribe(forceUpdate), []);
  return calculatorStore;
}
