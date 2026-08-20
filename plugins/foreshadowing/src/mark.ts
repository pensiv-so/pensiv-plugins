/**
 * The anchor layer: a TipTap mark that pins one foreshadowing beat to a span of
 * prose.
 *
 * ## Why the data lives in the document
 *
 * A foreshadowing beat *is* a piece of the manuscript — "the ring on the mantel,
 * chapter 2". Storing it as a mark rather than as a row in plugin storage buys
 * everything for free:
 *
 *  - it **moves with the text**, through insertions, deletions and reflow, which
 *    an offset stored on the side does not;
 *  - it **syncs** with the document, on the same path, with the same conflict
 *    rules, and shows up in version history;
 *  - it **survives** copy/paste and export, and a document restored from a
 *    snapshot brings its beats back with it;
 *  - deleting the sentence deletes the beat, which is the correct behaviour and
 *    is otherwise a dangling-reference bug.
 *
 * The mark carries the whole (small) record — id, group, kind, label, note —
 * rather than an id pointing at a side table, because a side table would have to
 * be kept in sync with edits the plugin never sees.
 *
 * Modelled on the host's own inline-comment mark: `inclusive: false` so typing at
 * an edge doesn't silently extend the beat, `excludes: ''` so two beats may share
 * characters, `keepOnSplit` so pressing Enter inside one doesn't destroy it.
 */
import { Mark, mergeAttributes } from '@tiptap/core';
// ProseMirror types come from the host's copy (`@tiptap/pm/*` is external and
// must never be bundled): two prosemirror copies fail each other's `instanceof`
// checks and poison the editor's decoration pipeline.
import type { Mark as PMMark, MarkType, Node as PMNode } from '@tiptap/pm/model';

export const FORESHADOW_MARK = 'foreshadow';

/** `setup` plants a beat; `payoff` is where it lands. */
export type ForeshadowKind = 'setup' | 'payoff';

/** What one mark carries. Kept small — it is copied into every text node it spans. */
export interface ForeshadowAttrs {
  /** Unique per anchor. */
  fid: string;
  /** Shared by a setup and every payoff that resolves it. */
  gid: string;
  kind: ForeshadowKind;
  /** Short user-facing name. Empty means "use the quoted text". */
  label: string;
  /**
   * The writer's plan for the beat — "how I mean to pay this off". Lives on the
   * *setup* mark; payoffs carry an empty one rather than a copy, so editing the
   * plan can't leave a stale duplicate twenty chapters away.
   *
   * Capped at {@link NOTE_MAX_LENGTH} on the way in: mark attributes are copied
   * into every text node the mark spans, so a beat split over four text nodes
   * pays for the note four times.
   */
  note: string;
}

/** Longest note we write into a mark. See {@link ForeshadowAttrs.note}. */
export const NOTE_MAX_LENGTH = 500;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    foreshadow: {
      /**
       * Anchor `attrs` to `range` — or to the current selection when omitted.
       *
       * The range is explicit because the caller is usually a menu or toolbar
       * item, and by the time it runs the selection may have collapsed (the menu
       * took focus, the tap moved the caret). The surface hands over the range it
       * snapshotted when it opened; this applies it verbatim.
       */
      setForeshadowAnchor: (
        attrs: ForeshadowAttrs,
        range?: { from: number; to: number }
      ) => ReturnType;
      /** Strip every mark carrying `fid`. */
      removeForeshadowAnchor: (fid: string) => ReturnType;
      /**
       * Strip every foreshadow mark whose `gid` is in `gids` — deleting a whole
       * beat (setup + payoffs) from this document, and sweeping marks whose
       * beat was deleted while another file was active.
       */
      removeForeshadowByGids: (gids: string[]) => ReturnType;
      /** Patch the attrs of every mark carrying `fid` (e.g. rename). */
      updateForeshadowAnchor: (fid: string, patch: Partial<ForeshadowAttrs>) => ReturnType;
    };
  }
}

const attr = (name: string, dataName: string) => ({
  default: '',
  parseHTML: (element: HTMLElement) => element.getAttribute(dataName) ?? '',
  renderHTML: (attributes: Record<string, unknown>) => {
    const value = attributes[name];
    return value ? { [dataName]: String(value) } : {};
  }
});

export const ForeshadowMark = Mark.create({
  name: FORESHADOW_MARK,

  // Typing at either edge must not silently swallow more text into the beat;
  // typing *inside* it still inherits the mark and grows the span, which is what
  // a writer expects when they revise the sentence they marked.
  inclusive: false,
  // Two beats may overlap — a payoff often lands inside another setup.
  excludes: '',
  // Splitting the paragraph must not destroy the beat.
  keepOnSplit: true,

  addAttributes() {
    return {
      fid: attr('fid', 'data-foreshadow-id'),
      gid: attr('gid', 'data-foreshadow-group'),
      kind: attr('kind', 'data-foreshadow-kind'),
      label: attr('label', 'data-foreshadow-label'),
      note: attr('note', 'data-foreshadow-note')
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-foreshadow-id]' }];
  },

  // The note is also the span's `title`, so the plan is readable by hovering the
  // sentence in the manuscript — the list is where you go to work through the
  // debt, but mid-paragraph the writer only wants to be reminded.
  renderHTML({ HTMLAttributes, mark }) {
    const note = String(mark.attrs.note ?? '').trim();
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'pensiv-foreshadow' }, note ? { title: note } : {}),
      0
    ];
  },

  addCommands() {
    return {
      setForeshadowAnchor:
        (attrs, range) =>
        ({ tr, state, dispatch }) => {
          const from = range?.from ?? state.selection.from;
          const to = range?.to ?? state.selection.to;
          if (!(from >= 0 && to > from && to <= state.doc.content.size)) return false;
          if (dispatch) {
            tr.addMark(from, to, this.type.create({ ...attrs }));
            dispatch(tr);
          }
          return true;
        },

      removeForeshadowAnchor:
        (fid) =>
        ({ tr, state, dispatch }) => {
          const ranges = findMarkRanges(state.doc, this.type, fid);
          if (ranges.length === 0) return false;
          if (dispatch) {
            for (const range of ranges) tr.removeMark(range.from, range.to, range.mark);
            dispatch(tr);
          }
          return true;
        },

      removeForeshadowByGids:
        (gids) =>
        ({ tr, state, dispatch }) => {
          const wanted = new Set(gids);
          const ranges: Array<{ from: number; to: number; mark: PMMark }> = [];
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            for (const mark of node.marks) {
              if (mark.type === this.type && wanted.has(String(mark.attrs.gid))) {
                ranges.push({ from: pos, to: pos + node.nodeSize, mark });
              }
            }
          });
          if (ranges.length === 0) return false;
          if (dispatch) {
            for (const range of ranges) tr.removeMark(range.from, range.to, range.mark);
            dispatch(tr);
          }
          return true;
        },

      updateForeshadowAnchor:
        (fid, patch) =>
        ({ tr, state, dispatch }) => {
          const ranges = findMarkRanges(state.doc, this.type, fid);
          if (ranges.length === 0) return false;
          if (dispatch) {
            for (const range of ranges) {
              tr.removeMark(range.from, range.to, range.mark);
              tr.addMark(
                range.from,
                range.to,
                this.type.create({ ...(range.mark.attrs as unknown as ForeshadowAttrs), ...patch })
              );
            }
            dispatch(tr);
          }
          return true;
        }
    };
  }
});

/**
 * Every text-node range carrying `fid`. Deliberately per text node: a span that
 * crosses a bold run or a paragraph break is several marks sharing one id, and a
 * command has to touch all of them.
 */
function findMarkRanges(
  doc: PMNode,
  type: MarkType,
  fid: string
): Array<{ from: number; to: number; mark: PMMark }> {
  const ranges: Array<{ from: number; to: number; mark: PMMark }> = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type === type && mark.attrs.fid === fid) {
        ranges.push({ from: pos, to: pos + node.nodeSize, mark });
      }
    }
  });
  return ranges;
}
