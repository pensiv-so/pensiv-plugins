import { useEffect, useReducer } from 'react';
import type { CategoryId } from './units';

/**
 * Shared converter state — a module-level singleton, the pattern the Timer plugin
 * documents. The floating card, the header dialog and the phone sheet are
 * separate mounts; only a singleton keeps the pair of units you picked in one
 * showing in the others.
 *
 * What you are converting right now is ephemeral scratch state, so it persists
 * *itself* to one `localStorage` key rather than to `app.storage`, which is for
 * durable settings.
 */
const STORAGE_KEY = 'pensiv:plugin:unit-converter:state';

interface Persisted {
  category: CategoryId;
  /** Kept as a string: `'1.'` and `'-'` are states a user can be mid-typing. */
  value: string;
  /** Chosen units per category, so switching back restores the last pair. */
  pairs: Partial<Record<CategoryId, { from: string; to: string }>>;
}

const defaults = (): Persisted => ({ category: 'length', value: '1', pairs: {} });

class UnitConverterStore {
  state: Persisted = defaults();

  private listeners = new Set<() => void>();

  constructor() {
    const stored = this.load();
    this.state = { ...defaults(), ...stored, pairs: { ...stored.pairs } };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setCategory(category: CategoryId): void {
    this.patch({ category });
  }

  setValue(value: string): void {
    this.patch({ value });
  }

  setPair(category: CategoryId, pair: { from: string; to: string }): void {
    this.patch({ pairs: { ...this.state.pairs, [category]: pair } });
  }

  pairFor(category: CategoryId): { from: string; to: string } | undefined {
    return this.state.pairs[category];
  }

  private patch(patch: Partial<Persisted>): void {
    this.state = { ...this.state, ...patch };
    this.persist();
    this.notify();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* storage may be unavailable; the converter stays in-memory */
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

export const converterStore = new UnitConverterStore();

/** Subscribe a component to {@link converterStore}; re-renders on every change. */
export function useConverterStore(): UnitConverterStore {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => converterStore.subscribe(forceUpdate), []);
  return converterStore;
}
