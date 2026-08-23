/**
 * The live block: a mark that tags an inserted status window so it can be found
 * and re-rendered later.
 *
 * ## Why a mark and not a node
 *
 * A custom node is the obvious way to build a "live block", and it is the wrong
 * one here. A node type only exists in the schema while the plugin is enabled;
 * disable it and `Node.fromJSON` meets a type it doesn't know. That is not a
 * degraded block — it is a document that fails to load. No plugin in this repo
 * registers an editor node, and a status window is not worth being the first.
 *
 * A mark degrades correctly. Disable the plugin and ProseMirror drops the mark
 * and keeps the text: the writer still has their status window, exactly as
 * typed, and re-enabling the plugin finds it again. That property is worth more
 * than anything a node view would add, because the block is plain text on
 * purpose — it exists to be pasted into 네이버시리즈, 문피아, カクヨム or Royal
 * Road, none of which know what a pensiv node is.
 *
 * ## One block, many marks
 *
 * Marks are inline, so a block spanning six paragraphs is six (or more) marks
 * that share a `bid`. Grouping by `bid` recovers the block; `blocks.ts` does
 * that and computes the span to replace on a refresh.
 */
import { Mark, mergeAttributes } from '@tiptap/core';
// ProseMirror types come from the host's copy (`@tiptap/pm/*` is external and
// must never be bundled): two ProseMirror copies fail each other's `instanceof`
// checks and poison the editor's decoration pipeline for the session.
import type {
  Mark as PMMark,
  MarkType,
  Node as PMNode,
  NodeType,
  Schema as PMSchema
} from '@tiptap/pm/model';

export const STATUS_MARK = 'statusBlock';

/** What one mark carries. Copied into every text node it spans, so: small. */
export interface StatusBlockAttrs {
  /** Identifies the block. Shared by every mark in it. */
  bid: string;
  /** Which character it renders. */
  cid: string;
  /** Which preset rendered it, so a refresh reproduces the same convention. */
  pid: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    statusWindow: {
      /**
       * Tag `range` as the block described by `attrs`.
       *
       * The range is explicit rather than read from the selection: the caller is
       * a pane button or a slash command, and by the time it runs the selection
       * has usually moved. Callers pass the range they computed when they
       * inserted the text.
       */
      setStatusBlock: (attrs: StatusBlockAttrs, range: { from: number; to: number }) => ReturnType;
      /**
       * Insert `text` as one paragraph per line at the cursor, marked in the
       * same transaction.
       *
       * This exists instead of `app.editor.insert(text)` + a follow-up mark for
       * two reasons, both of which are correctness rather than tidiness:
       *
       *  - the host's `insert` forwards to TipTap's `insertContent`, which parses
       *    a plain string as HTML — newlines collapse to spaces and a six-line
       *    status window arrives as one run-on paragraph;
       *  - marking afterwards means guessing the inserted range from the string
       *    length, and ProseMirror positions are not string offsets (every
       *    paragraph boundary adds two). The guess is short, so the tail of the
       *    block ends up unmarked and a later refresh rewrites only part of it.
       *
       * Building the nodes here makes both exact. `marked: false` inserts the
       * same paragraphs without the mark, for writers who turned live blocks off.
       */
      insertStatusBlock: (attrs: StatusBlockAttrs, text: string, marked: boolean) => ReturnType;
      /** Swap a block's text for `text`, keeping the mark on the new content. */
      replaceStatusBlock: (bid: string, text: string) => ReturnType;
      /** Strip the mark, leaving the text — "convert to plain text". */
      unmarkStatusBlock: (bid: string) => ReturnType;
      /** Strip every status-block mark in the document. */
      unmarkAllStatusBlocks: () => ReturnType;
    };
  }
}

const attr = (name: keyof StatusBlockAttrs, dataName: string) => ({
  default: '',
  parseHTML: (element: HTMLElement) => element.getAttribute(dataName) ?? '',
  renderHTML: (attributes: Record<string, unknown>) => {
    const value = attributes[name];
    return value ? { [dataName]: String(value) } : {};
  }
});

export const StatusBlockMark = Mark.create({
  name: STATUS_MARK,

  // Typing at either edge must not pull surrounding prose into the block —
  // otherwise the next sentence the writer types becomes part of the status
  // window and gets destroyed by the next refresh.
  inclusive: false,
  // Nothing else claims this space, and overlapping another plugin's mark is
  // harmless.
  excludes: '',
  // A status window is several paragraphs; splitting must not dissolve it.
  keepOnSplit: true,

  addAttributes() {
    return {
      bid: attr('bid', 'data-status-block'),
      cid: attr('cid', 'data-status-character'),
      pid: attr('pid', 'data-status-preset')
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-status-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'pnsv-sw-block' }), 0];
  },

  addCommands() {
    return {
      setStatusBlock:
        (attrs, range) =>
        ({ tr, state, dispatch }) => {
          const { from, to } = range;
          if (!(from >= 0 && to > from && to <= state.doc.content.size)) return false;
          if (dispatch) {
            tr.addMark(from, to, this.type.create({ ...attrs }));
            dispatch(tr);
          }
          return true;
        },

      insertStatusBlock:
        (attrs, text, marked) =>
        ({ tr, state, dispatch }) => {
          const paragraph = state.schema.nodes.paragraph;
          if (!paragraph) return false;
          if (!dispatch) return true;

          const marks = marked ? [this.type.create({ ...attrs })] : [];
          const paragraphs = buildParagraphs(state.schema, paragraph, text, marks);

          const { from, to } = state.selection;
          tr.replaceWith(from, to, paragraphs);
          dispatch(tr);
          return true;
        },

      /**
       * Replace the block's text in place.
       *
       * The whole span goes and the new text comes back marked, rather than
       * diffing line by line: a status window is generated output, the writer
       * does not hand-edit it, and a diff would only add ways to leave half a
       * block behind. Paragraph breaks are preserved by splitting on newlines
       * and inserting hard breaks, so a six-line block stays six lines.
       */
      replaceStatusBlock:
        (bid, text) =>
        ({ tr, state, dispatch }) => {
          const span = markSpan(state.doc, this.type, bid);
          if (!span) return false;

          // No-op guard. With auto-refresh on, this command runs on every
          // keystroke in the pane, and dispatching an identical rewrite would
          // still push one undo step each time — the writer's ⌘Z would walk
          // through invisible "changes". `textBetween` with '\n' mirrors how
          // `buildParagraphs` splits, so equal strings mean an equal block.
          if (state.doc.textBetween(span.from, span.to, '\n') === text) return true;

          if (!dispatch) return true;

          const attrs = span.mark.attrs as unknown as StatusBlockAttrs;
          const { schema } = state;
          // Every editor in this app has `paragraph`, but the schema is the
          // host's to define — refuse rather than throw if that ever changes.
          const paragraph = schema.nodes.paragraph;
          if (!paragraph) return false;

          const paragraphs = buildParagraphs(schema, paragraph, text, [
            this.type.create({ ...attrs })
          ]);

          tr.replaceWith(span.from, span.to, paragraphs);
          dispatch(tr);
          return true;
        },

      unmarkStatusBlock:
        (bid) =>
        ({ tr, state, dispatch }) => {
          const ranges = markRanges(state.doc, this.type, bid);
          if (ranges.length === 0) return false;
          if (dispatch) {
            for (const range of ranges) tr.removeMark(range.from, range.to, range.mark);
            dispatch(tr);
          }
          return true;
        },

      unmarkAllStatusBlocks:
        () =>
        ({ tr, state, dispatch }) => {
          const ranges: Array<{ from: number; to: number; mark: PMMark }> = [];
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            for (const mark of node.marks) {
              if (mark.type === this.type) ranges.push({ from: pos, to: pos + node.nodeSize, mark });
            }
          });
          if (ranges.length === 0) return false;
          if (dispatch) {
            for (const range of ranges) tr.removeMark(range.from, range.to, range.mark);
            dispatch(tr);
          }
          return true;
        }
    };
  }
});

/**
 * One paragraph per line, carrying `marks`.
 *
 * An empty line becomes a paragraph with **no content at all**, not one holding
 * an empty text node — ProseMirror rejects zero-length text, and a status window
 * has blank lines between its groups.
 */
function buildParagraphs(
  schema: PMSchema,
  paragraph: NodeType,
  text: string,
  marks: readonly PMMark[]
): PMNode[] {
  return text
    .split('\n')
    .map((line) => paragraph.create(null, line === '' ? null : schema.text(line, marks)));
}

/**
 * Every text-node range carrying `bid`.
 *
 * Per text node deliberately: a block that crosses a paragraph break — which
 * every status window does — is many marks sharing one id, and a command has to
 * touch all of them.
 */
export function markRanges(
  doc: PMNode,
  type: MarkType,
  bid: string
): Array<{ from: number; to: number; mark: PMMark }> {
  const ranges: Array<{ from: number; to: number; mark: PMMark }> = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type === type && mark.attrs.bid === bid) {
        ranges.push({ from: pos, to: pos + node.nodeSize, mark });
      }
    }
  });
  return ranges;
}

/**
 * The outer span of a block, from the start of its first paragraph to the end of
 * its last.
 *
 * Node positions, not text positions: a replacement has to swap whole paragraphs
 * (otherwise the line breaks between them survive and the new text lands inside
 * the old structure), so the span is widened to the enclosing block nodes.
 */
export function markSpan(
  doc: PMNode,
  type: MarkType,
  bid: string
): { from: number; to: number; mark: PMMark } | undefined {
  let from = Infinity;
  let to = -Infinity;
  let found: PMMark | undefined;

  doc.descendants((node, pos, parent) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type !== type || mark.attrs.bid !== bid) continue;
      found = found ?? mark;
      // Widen to the parent block so `replaceWith` can hand back paragraphs.
      const blockFrom = parent && parent.isBlock ? pos - 1 : pos;
      const blockTo = parent && parent.isBlock ? pos - 1 + parent.nodeSize : pos + node.nodeSize;
      if (blockFrom < from) from = blockFrom;
      if (blockTo > to) to = blockTo;
    }
  });

  if (!found || from === Infinity) return undefined;
  return { from: Math.max(0, from), to: Math.min(doc.content.size, to), mark: found };
}

/** Every distinct block id present in the document, with its attributes. */
export function collectBlocks(doc: PMNode, type: MarkType): Map<string, StatusBlockAttrs> {
  const blocks = new Map<string, StatusBlockAttrs>();
  doc.descendants((node) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type !== type) continue;
      const attrs = mark.attrs as unknown as StatusBlockAttrs;
      if (attrs.bid && !blocks.has(attrs.bid)) blocks.set(attrs.bid, attrs);
    }
  });
  return blocks;
}
