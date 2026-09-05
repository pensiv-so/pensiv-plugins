import type { HostApi } from '@pensiv/plugin-sdk';
import { STR, tr } from './i18n';

/**
 * What the clipboard is allowed to do while a session runs.
 *
 * The original Dangerous Writing Prompt App gives you no clipboard at all, and
 * that is load-bearing: if you can select-all and copy every minute or so, the
 * page you are about to burn has a backup, and the dare stops being a dare.
 * Pasting is the other half — pre-written text should not count toward a word
 * goal. Both are choices here rather than hard rules, since a session run on a
 * document you are genuinely drafting sometimes needs the clipboard back.
 *
 *  - `all`   — copy, cut, paste and text-drag are all dead. No escape hatch.
 *  - `paste` — only the ways text gets *in* are blocked; copying out is fine.
 *  - `off`   — no restriction at all.
 */
export type ClipboardMode = 'all' | 'paste' | 'off';

const MODES: readonly ClipboardMode[] = ['all', 'paste', 'off'];

/** Narrow a stored settings value to a {@link ClipboardMode} (defaults to `all`). */
export const toClipboardMode = (value: unknown): ClipboardMode =>
  MODES.includes(value as ClipboardMode) ? (value as ClipboardMode) : 'all';

/**
 * The DOM events each mode kills. `drop` is a paste made with the mouse and
 * `dragstart` a copy made with one — blocking the keyboard path alone would
 * leave both doors open.
 *
 * `contextmenu` is here because the editor's right-click menu runs its own
 * Copy / Cut / Paste through `navigator.clipboard` rather than through the
 * clipboard events, so those items would sail straight past the rest of this
 * list. Suppressing the menu is the scoped way to close that door — it costs
 * the menu's other items for the length of the run, which is why `paste` mode
 * loses it too: the menu's paste entries are in there either way.
 */
const BLOCKED: Record<ClipboardMode, readonly string[]> = {
  all: ['paste', 'drop', 'copy', 'cut', 'dragstart', 'contextmenu'],
  paste: ['paste', 'drop', 'contextmenu'],
  off: []
};

/** Event types that put text *into* the document, for the right toast wording. */
const INBOUND = new Set(['paste', 'drop']);

/** What to say when `type` was blocked under `mode`. */
const messageFor = (type: string, mode: ClipboardMode) => {
  if (type === 'contextmenu') return mode === 'all' ? STR.clipNoteAll : STR.clipNotePaste;
  return INBOUND.has(type) ? STR.pasteLocked : STR.copyLocked;
};

/** How long before the same "that's locked" toast may fire again. */
const TOAST_COOLDOWN_MS = 2500;

/** The document editor containing `node`, if any. */
const editorOf = (node: Node | null | undefined): Element | null => {
  const el = node instanceof Element ? node : (node?.parentElement ?? null);
  return el?.closest?.('.ProseMirror') ?? null;
};

/**
 * Does this event act on a document editor?
 *
 * The same copy can arrive from a keystroke, the app's Edit menu or the native
 * context menu, and each one names a different node: the event target, the
 * focused element, or — when focus sits on a toolbar button — the node the
 * selection starts in. Any other text field owning the event wins first, so
 * copying out of a search box or a side-pane input stays untouched.
 */
const hitsEditor = (e: Event): boolean => {
  const target = e.target as Node | null;
  if (editorOf(target)) return true;
  const el = target instanceof Element ? target : (target?.parentElement ?? null);
  if (el?.closest?.('input, textarea, [contenteditable]')) return false;
  return !!editorOf(document.activeElement) || !!editorOf(window.getSelection()?.anchorNode);
};

/**
 * Lock the clipboard for the duration of a session. Returns the uninstall, so
 * the guard lives exactly as long as the run does — outside a session the
 * editor behaves normally.
 *
 * Listeners are capture-phase on `window` and stop propagation, so the event is
 * dead before ProseMirror's own handlers ever see it.
 */
export function installClipboardGuard(app: HostApi, mode: ClipboardMode): () => void {
  const types = BLOCKED[mode] ?? [];
  if (types.length === 0) return () => {};

  let lastToastAt = 0;
  const block = (e: Event): void => {
    if (!hitsEditor(e)) return;
    e.preventDefault();
    e.stopPropagation();
    // Say why, once — a shortcut that silently does nothing reads as a bug.
    const now = Date.now();
    if (now - lastToastAt < TOAST_COOLDOWN_MS) return;
    lastToastAt = now;
    try {
      app.ui.toast(tr(app, messageFor(e.type, mode)));
    } catch {
      /* the toast is cosmetic; the block already happened */
    }
  };

  types.forEach((type) => window.addEventListener(type, block, true));
  return () => types.forEach((type) => window.removeEventListener(type, block, true));
}
