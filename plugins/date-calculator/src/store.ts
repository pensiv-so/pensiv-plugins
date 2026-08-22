import { useEffect, useReducer } from 'react';
import type { HostApi } from '@pensiv/plugin-sdk';
import { toISO, type CivilDate, type ShiftUnit } from './engine';

/**
 * Shared run-state — a module-level singleton, the pattern the Timer plugin
 * documents. The floating card, the header dialog and the phone sheet are
 * separate mounts; only a singleton keeps the dates you typed in one visible in
 * the others.
 *
 * The dates are ephemeral scratch input, so they persist *themselves* to one
 * `localStorage` key rather than to `app.storage`: which two dates you are
 * currently subtracting is on-device state, not a setting worth syncing.
 */
const STORAGE_KEY = 'pensiv:plugin:date-calculator:state';

export type Mode = 'age' | 'between' | 'shift';

interface Persisted {
  mode: Mode;
  /** All dates are `YYYY-MM-DD`; `''` means "not filled in yet". */
  birth: string;
  reference: string;
  from: string;
  to: string;
  shiftBase: string;
  shiftAmount: number;
  shiftUnit: ShiftUnit;
  /** `1` adds, `-1` subtracts. Kept apart from the amount so the amount stays positive. */
  shiftSign: 1 | -1;
  /**
   * Set the first time a surface mounts. It is what separates "a fresh install,
   * seed the mode from settings" from "the user has been here", so the *setting*
   * can't keep overriding the mode the user last chose.
   */
  seeded: boolean;
}

const defaults = (): Persisted => ({
  mode: 'age',
  birth: '',
  reference: '',
  from: '',
  to: '',
  shiftBase: '',
  shiftAmount: 30,
  shiftUnit: 'days',
  shiftSign: 1,
  seeded: false
});

class DateCalculatorStore {
  state: Persisted = defaults();

  private listeners = new Set<() => void>();

  constructor() {
    this.state = { ...defaults(), ...this.load() };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  patch(patch: Partial<Persisted>): void {
    this.state = { ...this.state, ...patch };
    this.persist();
    this.notify();
  }

  /**
   * Fill any date left blank with today, and on a fresh install adopt the mode
   * the settings ask to open on. Called on mount rather than in the constructor
   * because "today" has to come from the host clock, and because a widget left
   * open past midnight should still open on the new day.
   *
   * `defaultMode` is applied once, guarded by `seeded`: it is a starting point,
   * not a preference that outranks the mode the user last switched to.
   */
  hydrate(today: CivilDate, defaultMode?: Mode): void {
    const iso = toISO(today);
    const patch: Partial<Persisted> = {};
    if (!this.state.reference) patch.reference = iso;
    if (!this.state.from) patch.from = iso;
    if (!this.state.to) patch.to = iso;
    if (!this.state.shiftBase) patch.shiftBase = iso;
    if (!this.state.seeded) {
      patch.seeded = true;
      if (defaultMode) patch.mode = defaultMode;
    }
    if (Object.keys(patch).length > 0) this.patch(patch);
  }

  reset(today: CivilDate): void {
    // Reset clears the dates, not the user's place: the mode stays, and `seeded`
    // stays set so the default-mode setting doesn't pull the rug afterwards.
    this.state = { ...defaults(), mode: this.state.mode, seeded: true };
    this.persist();
    this.notify();
    this.hydrate(today);
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* storage may be unavailable; the dates stay in-memory */
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

export const dateStore = new DateCalculatorStore();

/** Subscribe a component to {@link dateStore}; re-renders on every change. */
export function useDateStore(): DateCalculatorStore {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => dateStore.subscribe(forceUpdate), []);
  return dateStore;
}

/**
 * Today, as a civil date on the host clock. `app.platform.now()` rather than
 * `Date.now()` so the host stays the single source of time (and a test host can
 * pin it); the local-time getters are then what turn that instant into the date
 * the *user* is living in.
 */
export function today(app: HostApi): CivilDate {
  const now = new Date(app.platform.now());
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}
