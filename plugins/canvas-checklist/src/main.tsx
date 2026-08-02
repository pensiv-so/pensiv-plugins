import * as React from 'react';
import {
  Plugin,
  resolveLocalizedText,
  type CanvasNodeState,
  type CanvasNodeViewProps,
  type HostApi,
  type LocalizedText
} from '@pensiv/plugin-sdk';
import './styles.css';
import { nextId, readItems, type ChecklistItem } from './items';

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
 *
 * The look is deliberately *not* invented here: the checkbox is a port of the
 * app's own task-list checkbox, the progress track is the goal widgets' track,
 * and the add/delete buttons are the native ghost button recipe (see
 * {@link file://./styles.css}). A plugin node should be indistinguishable from a
 * native one until you read what it says.
 */

const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });
const tr = (app: HostApi, text: LocalizedText): string =>
  resolveLocalizedText(text, app.app.locale);

const STR = {
  name: L('Checklist', '체크리스트', 'チェックリスト'),
  addItem: L('Add item', '항목 추가', '項目を追加'),
  firstItem: L('First item', '첫 번째 항목', '最初の項目'),
  itemPlaceholder: L('Item', '항목', '項目'),
  empty: L('No items yet', '항목이 없습니다', '項目がありません'),
  remove: L('Remove item', '항목 삭제', '項目を削除'),
  full: L(
    'This checklist is full — start a new node.',
    '이 체크리스트가 가득 찼습니다. 새 노드를 만들어 주세요.',
    'このチェックリストは満杯です。新しいノードを作成してください。'
  )
};

const TrashIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="0.875rem"
    height="0.875rem"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
);

const PlusIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="0.875rem"
    height="0.875rem"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

interface RowProps {
  item: ChecklistItem;
  app: HostApi;
  readOnly: boolean;
  /** Set to this row's id when it should take focus after a structural edit. */
  focusId: string | null;
  onFocused: () => void;
  onToggle: () => void;
  onRename: (text: string) => void;
  onRemove: () => void;
  onSplit: () => void;
}

const Row: React.FC<RowProps> = ({
  item,
  app,
  readOnly,
  focusId,
  onFocused,
  onToggle,
  onRename,
  onRemove,
  onSplit
}) => {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  // Auto-grow so a long item wraps instead of scrolling inside a one-line box —
  // the node itself is resizable, the text field should never be.
  const fit = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  React.useLayoutEffect(fit, [item.text, fit]);

  // Focus lands here after Enter (new row) or Backspace (previous row), with the
  // caret at the end — the same behaviour as the native task list.
  React.useEffect(() => {
    if (focusId !== item.id) return;
    const el = ref.current;
    onFocused();
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [focusId, item.id, onFocused]);

  return (
    <div className={`pnsv-cl-row${item.done ? ' done' : ''}`}>
      <input
        type="checkbox"
        className="pnsv-cl-box"
        checked={item.done}
        disabled={readOnly}
        onChange={onToggle}
        aria-label={item.text || tr(app, STR.itemPlaceholder)}
      />
      {readOnly ? (
        <span className="pnsv-cl-text">{item.text}</span>
      ) : (
        <>
          <textarea
            ref={ref}
            className="pnsv-cl-text"
            rows={1}
            value={item.text}
            placeholder={tr(app, STR.itemPlaceholder)}
            spellCheck={false}
            onChange={(e) => onRename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                onSplit();
                return;
              }
              // Backspace in an empty row removes it, like the native list.
              if (e.key === 'Backspace' && item.text === '') {
                e.preventDefault();
                onRemove();
              }
            }}
          />
          <button
            type="button"
            className="pnsv-cl-del"
            title={tr(app, STR.remove)}
            aria-label={tr(app, STR.remove)}
            onClick={onRemove}
          >
            <TrashIcon />
          </button>
        </>
      )}
    </div>
  );
};

function ChecklistNode({ state, setState, readOnly, app }: CanvasNodeViewProps) {
  const items = readItems(state);
  const done = items.filter((item) => item.done).length;
  const pct = items.length > 0 ? (done / items.length) * 100 : 0;

  const [focusId, setFocusId] = React.useState<string | null>(null);
  const clearFocus = React.useCallback(() => setFocusId(null), []);

  const write = (next: ChecklistItem[]): boolean => {
    // `setState` returns false when the write would exceed the 16 KB cap. Tell
    // the user rather than dropping the edit on the floor.
    const ok = setState({ items: next as unknown as CanvasNodeState });
    if (!ok) app.ui.toast(tr(app, STR.full));
    return ok;
  };

  const toggle = (id: string): void => {
    write(items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };

  const rename = (id: string, text: string): void => {
    write(items.map((item) => (item.id === id ? { ...item, text } : item)));
  };

  const remove = (id: string): void => {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return;
    // Focus falls back to the row above, so a run of Backspaces walks the list.
    const previous = index > 0 ? items[index - 1] : undefined;
    if (write(items.filter((item) => item.id !== id)) && previous) {
      setFocusId(previous.id);
    }
  };

  /** Insert a fresh row after `index` (end of list when omitted) and focus it. */
  const insertAfter = (index: number): void => {
    const id = nextId(items);
    const next = [...items];
    next.splice(index + 1, 0, { id, text: '', done: false });
    if (write(next)) setFocusId(id);
  };

  return (
    <div className="pnsv-cl">
      <div className="pnsv-cl-head">
        <span className="pnsv-cl-count">
          {done}/{items.length}
        </span>
        <span className="pnsv-cl-track">
          <span className="pnsv-cl-bar" style={{ width: `${pct}%` }} />
        </span>
      </div>

      <div className="pnsv-cl-list">
        {items.length === 0 && readOnly ? (
          <span className="pnsv-cl-empty">{tr(app, STR.empty)}</span>
        ) : null}

        {items.map((item, index) => (
          <Row
            key={item.id}
            item={item}
            app={app}
            readOnly={readOnly}
            focusId={focusId}
            onFocused={clearFocus}
            onToggle={() => toggle(item.id)}
            onRename={(text) => rename(item.id, text)}
            onRemove={() => remove(item.id)}
            onSplit={() => insertAfter(index)}
          />
        ))}

        {!readOnly && (
          <button
            type="button"
            className="pnsv-cl-add"
            onClick={() => insertAfter(items.length - 1)}
          >
            <PlusIcon />
            {tr(app, STR.addItem)}
          </button>
        )}
      </div>
    </div>
  );
}

export default class CanvasChecklistPlugin extends Plugin {
  onload(): void {
    this.registerCanvasNode({
      id: 'checklist',
      // Toolbar label, resolved in the live UI language like every native entry.
      name: tr(this.app, STR.name),
      icon: 'SquareCheck',
      defaultSize: { width: 260, height: 180 },
      // Fresh nodes start with one row so the card is never a blank rectangle.
      createDefaultState: () => ({
        items: [
          { id: 'i1', text: resolveLocalizedText(STR.firstItem, this.app.app.locale), done: false }
        ]
      }),
      render: ChecklistNode
    });
  }
}
