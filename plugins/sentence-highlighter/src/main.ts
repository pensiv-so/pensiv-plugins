import { Plugin, type EditorRange, type Unsub } from '@pensiv/plugin-sdk';

/**
 * The reference example for `app.editor.decorate()` and `registerSlashItem()`.
 *
 * It highlights sentences longer than a configurable word count — the sort of
 * "show me what to trim" pass a writer runs before a revision.
 *
 * Three things worth copying:
 *
 *  1. **Decorations are plain numbers.** You pass `{ from, to }` positions and
 *     the host builds the ProseMirror `DecorationSet`. You never construct one
 *     yourself — a set built by a plugin's own prosemirror copy fails the host's
 *     `instanceof` check and freezes the editor.
 *  2. **Compute positions from `getDoc()`, not `getText()`.** See
 *     {@link collectBlocks}. This is the single easiest thing to get wrong.
 *  3. **Positions are static.** They are clamped to the document but not mapped
 *     through later edits, so re-`decorate()` on `editor.on('update')`.
 */

const DEFAULT_LIMIT = 30;

/** The ProseMirror JSON shape we walk. Structural only — no schema knowledge. */
interface PmNode {
  type?: string;
  text?: string;
  content?: PmNode[];
}

interface TextBlock {
  text: string;
  /** Absolute ProseMirror position of the block's first character. */
  from: number;
}

/**
 * ProseMirror node size: a text node costs its length, every other node costs
 * its content plus one token for its own open and close.
 */
function nodeSize(node: PmNode): number {
  if (typeof node.text === 'string') return node.text.length;
  const inner = (node.content ?? []).reduce((sum, child) => sum + nodeSize(child), 0);
  return inner + 2;
}

/**
 * Flatten the document into text blocks carrying their **real** ProseMirror
 * positions.
 *
 * Why not `app.editor.getText()`? Because its offsets are not ProseMirror
 * positions. `getText()` joins blocks with a separator string, while ProseMirror
 * spends two positions on every block boundary (the close token of one node and
 * the open token of the next) and more for nesting. The two only agree inside
 * the first block — so `offset + 1` looks perfect in a one-paragraph test
 * document and drifts further with every paragraph in a real one. Decorations
 * then land on the wrong words, which is worse than not highlighting at all.
 *
 * Walking `getDoc()` and accumulating `nodeSize` is the correct mapping, and it
 * is about fifteen lines.
 *
 * Non-text inline nodes (images, mentions) are padded with spaces so offsets
 * inside a block stay aligned without them being treated as words.
 */
function collectBlocks(doc: PmNode): TextBlock[] {
  const blocks: TextBlock[] = [];

  const visit = (node: PmNode, contentStart: number): void => {
    let pos = contentStart;
    for (const child of node.content ?? []) {
      const children = child.content ?? [];
      const isTextBlock = children.some((c) => typeof c.text === 'string');

      if (isTextBlock) {
        let text = '';
        for (const inline of children) {
          text +=
            typeof inline.text === 'string' ? inline.text : ' '.repeat(nodeSize(inline));
        }
        // +1: the block's content starts one position after the block itself.
        if (text.trim().length > 0) blocks.push({ text, from: pos + 1 });
      } else if (children.length > 0) {
        // A container (blockquote, list item, table cell) — recurse into it.
        visit(child, pos + 1);
      }

      pos += nodeSize(child);
    }
  };

  // The doc's children start at position 0.
  visit(doc, 0);
  return blocks;
}

/** Sentence boundaries, keeping the terminator so offsets stay exact. */
function splitSentences(text: string): Array<{ text: string; offset: number }> {
  const out: Array<{ text: string; offset: number }> = [];
  const re = /[^.!?…。！？]*[.!?…。！？]+|[^.!?…。！？]+$/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match[0].trim().length > 0) out.push({ text: match[0], offset: match.index });
  }
  return out;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

export default class SentenceHighlighterPlugin extends Plugin {
  private clearDecorations: Unsub | null = null;
  private editorSub: Unsub | null = null;

  onload(): void {
    this.addSettingTab({
      title: 'Sentence Highlighter',
      schema: {
        fields: [
          {
            key: 'limit',
            type: 'slider',
            label: 'Flag sentences longer than',
            description: 'Sentences above this word count are highlighted.',
            default: DEFAULT_LIMIT,
            min: 10,
            max: 80,
            step: 5,
            unit: ' words'
          },
          {
            key: 'live',
            type: 'toggle',
            label: 'Update while typing',
            description: 'Recompute after every edit instead of only on demand.',
            default: false
          }
        ]
      }
    });

    this.addCommand({
      id: 'toggle',
      name: 'Sentence Highlighter: Toggle',
      run: () => this.toggle()
    });

    // A `/` menu row. Document editor only by default; widen with `surfaces`.
    this.registerSlashItem({
      id: 'highlight-long',
      title: 'Highlight long sentences',
      description: 'Mark sentences over the configured word count',
      icon: 'Sparkles',
      run: () => this.toggle()
    });

    // Registering a teardown here means a disable / reload always clears the
    // highlights, even if the user left them on.
    this.register(() => this.stop());
  }

  onunload(): void {
    this.stop();
  }

  private toggle(): void {
    if (this.clearDecorations) {
      this.stop();
      this.app.ui.toast('Highlights off');
      return;
    }

    const count = this.refresh();
    if (this.app.storage.get<boolean>('live')) {
      // Re-decorating on every update keeps the marks pinned to the text as it
      // moves; without this they would drift, since positions are not mapped.
      this.editorSub = this.app.editor.on('update', () => this.refresh());
    }
    this.app.ui.toast(
      count === 0 ? 'No long sentences found' : `Highlighted ${count} long sentence(s)`
    );
  }

  private stop(): void {
    this.clearDecorations?.();
    this.clearDecorations = null;
    this.editorSub?.();
    this.editorSub = null;
  }

  /** Recompute and repaint. Returns how many sentences were flagged. */
  private refresh(): number {
    // Always drop the previous set first — decorate() adds, it does not replace.
    this.clearDecorations?.();
    this.clearDecorations = null;

    const limit = this.app.storage.get<number>('limit') ?? DEFAULT_LIMIT;
    const doc = this.app.editor.getDoc() as PmNode | null;
    if (!doc) return 0;

    const ranges: EditorRange[] = [];
    for (const block of collectBlocks(doc)) {
      for (const sentence of splitSentences(block.text)) {
        if (countWords(sentence.text) <= limit) continue;
        // Trim leading whitespace so the highlight starts on the first word.
        const lead = sentence.text.length - sentence.text.trimStart().length;
        const from = block.from + sentence.offset + lead;
        const to = block.from + sentence.offset + sentence.text.trimEnd().length;
        if (to > from) ranges.push({ from, to });
      }
    }

    if (ranges.length > 0) this.clearDecorations = this.app.editor.decorate(ranges);
    return ranges.length;
  }
}
