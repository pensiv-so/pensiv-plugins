import * as React from 'react';
import { Plugin, type CanvasNodeState, type CanvasNodeViewProps } from '@pensiv/plugin-sdk';

/**
 * The reference example for `registerCanvasNode()` — a plugin's own object on a
 * canvas, sitting next to the built-in note, file and image cards.
 *
 * Four things worth copying:
 *
 *  1. **You render the inside; the host owns the rest.** Position, size,
 *     selection, z-order, grouping, undo, copy/paste, sync, export and cascade
 *     delete are all the host's. Do not draw a frame, a resizer, or handles.
 *  2. **`state` is the whole persistence story.** Call `setState` and the value
 *     rides the canvas's normal debounced writer — same undo stack, same sync.
 *     There is no separate save.
 *  3. **`setState` can say no.** State is capped at 16 KB serialized, because it
 *     lives inside the canvas's single content blob. It returns `false` when the
 *     write was refused; the example below uses that to stop adding items rather
 *     than silently losing them.
 *  4. **Respect `readOnly`.** Version-history previews and export layouts render
 *     the same component with `readOnly: true`. Show the value, hide the
 *     controls — a checkbox that does nothing is worse than no checkbox.
 */

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

/** Narrow the opaque `state` into our shape, tolerating anything unexpected. */
function readItems(state: CanvasNodeState): ChecklistItem[] {
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

const wrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  padding: '0.5rem',
  fontSize: '0.8125rem',
  color: 'hsl(var(--foreground))'
};

const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem' };

const addButton: React.CSSProperties = {
  marginTop: '0.25rem',
  alignSelf: 'flex-start',
  background: 'transparent',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'hsl(var(--muted-foreground))',
  cursor: 'pointer'
};

function ChecklistNode({ state, setState, readOnly, app }: CanvasNodeViewProps) {
  const items = readItems(state);
  const done = items.filter((item) => item.done).length;

  // Ids must be stable across reloads and devices, and Math.random / Date.now
  // would both drift between two clients editing the same canvas. Deriving from
  // the existing rows keeps it deterministic for a given state.
  const nextId = (): string => `i${items.length + 1}-${items.length}`;

  const write = (next: ChecklistItem[]): void => {
    // `setState` returns false when the write would exceed the 16 KB cap. Tell
    // the user rather than dropping the edit on the floor.
    const ok = setState({ items: next as unknown as CanvasNodeState });
    if (!ok) app.ui.toast('This checklist is full — start a new node.');
  };

  const toggle = (id: string): void => {
    write(items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };

  const rename = (id: string, text: string): void => {
    write(items.map((item) => (item.id === id ? { ...item, text } : item)));
  };

  return (
    <div style={wrap}>
      <strong style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
        {done}/{items.length} done
      </strong>

      {items.map((item) => (
        <label key={item.id} style={row}>
          <input
            type="checkbox"
            checked={item.done}
            disabled={readOnly}
            onChange={() => toggle(item.id)}
          />
          {readOnly ? (
            <span style={{ textDecoration: item.done ? 'line-through' : undefined }}>
              {item.text}
            </span>
          ) : (
            <input
              value={item.text}
              onChange={(e) => rename(item.id, e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                font: 'inherit',
                color: 'inherit',
                outline: 'none',
                textDecoration: item.done ? 'line-through' : undefined
              }}
            />
          )}
        </label>
      ))}

      {!readOnly && (
        <button
          style={addButton}
          onClick={() => write([...items, { id: nextId(), text: 'New item', done: false }])}
        >
          + Add item
        </button>
      )}
    </div>
  );
}

export default class CanvasChecklistPlugin extends Plugin {
  onload(): void {
    this.registerCanvasNode({
      id: 'checklist',
      name: 'Checklist',
      icon: 'List',
      defaultSize: { width: 260, height: 180 },
      // Fresh nodes start with one row so the card is never a blank rectangle.
      createDefaultState: () => ({ items: [{ id: 'i1-0', text: 'First item', done: false }] }),
      render: ChecklistNode
    });
  }
}
