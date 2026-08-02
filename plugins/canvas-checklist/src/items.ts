import type { CanvasNodeState } from '@pensiv/plugin-sdk';

/**
 * The checklist's data layer — kept free of React and of the CSS import so it
 * can be unit-tested on its own. Everything here has to survive a JSON round
 * trip through the canvas blob and, on the other side, whatever a previous
 * version (or a hand-edited canvas) left behind.
 */

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

/**
 * Narrow the opaque `state` into our shape, tolerating anything unexpected —
 * a missing `items`, a non-array, rows that aren't objects, rows missing
 * `id`/`text`. A malformed row is dropped, never thrown on: the alternative is
 * a canvas that won't render because one node's payload is odd.
 */
export function readItems(state: CanvasNodeState): ChecklistItem[] {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return [];
  const raw = (state as Record<string, CanvasNodeState>).items;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, CanvasNodeState>;
    if (typeof row.id !== 'string' || typeof row.text !== 'string') return [];
    return [{ id: row.id, text: row.text, done: row.done === true }];
  });
}

/**
 * Next row id. Derived from the highest existing suffix rather than
 * `Date.now()` / `Math.random()`: those drift between two clients editing the
 * same canvas, and a length-based counter collides as soon as a row is deleted.
 */
export function nextId(items: ChecklistItem[]): string {
  const highest = items.reduce((max, item) => {
    const n = Number.parseInt(item.id.replace(/^i/, ''), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `i${highest + 1}`;
}
