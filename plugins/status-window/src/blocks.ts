/**
 * Putting a status window into the prose, and keeping it current.
 *
 * ## Insertion is plain text, always
 *
 * Ordinary paragraphs — no custom node, no embed. The block a writer produces is
 * going to be pasted into a publishing platform, and every one of them takes
 * plain text and nothing else. The mark that makes a block "live" is purely
 * additive: strip it and the status window is unchanged.
 *
 * ## Refreshing
 *
 * A refresh re-renders from the current fold and swaps the marked span. It is
 * the same {@link renderStatusBlock} call the pane's preview makes, so what the
 * writer previewed and what the refresher writes cannot disagree.
 */
import type { HostApi } from '@pensiv/plugin-sdk';
import { collectBlocks, STATUS_MARK, type StatusBlockAttrs } from './mark';
import { newId, type CharacterSchema } from './model';
import { getPreset } from './library';
import { renderStatusBlock } from './render';
import {
  episodeOrder,
  foldTo,
  pruneBlocks,
  readBlocks,
  readCharacters,
  readSchema,
  rememberBlock,
  type EpisodeScope
} from './storage';

/** Settings the insert/refresh path needs. Read once per call, not per row. */
export interface BlockSettings {
  presetId: string;
  omitEmpty: boolean;
  liveBlocks: boolean;
  scope: EpisodeScope;
  /** Per-preset template overrides the writer has edited. */
  templates: Record<string, string>;
}

/**
 * Render one character's window for one episode, using the stored fold.
 *
 * The single place the pane preview, the insert button, the slash command and
 * the refresher all go through.
 */
export function renderFor(
  app: HostApi,
  settings: BlockSettings,
  episodeId: string,
  charId: string,
  presetId = settings.presetId
): { text: string; error?: string; schema: CharacterSchema } {
  const preset = getPreset(app, presetId);
  const schema = readSchema(app, charId, preset);
  const episodes = episodeOrder(app, settings.scope, episodeId);
  const { values, previous, index } = foldTo(app, episodes, episodeId, charId);

  const character = readCharacters(app).find((c) => c.id === charId);
  const episode = episodes[index] ?? (episodeId ? app.project.get?.(episodeId) : undefined);

  const result = renderStatusBlock(preset, {
    schema,
    values,
    previous,
    characterName: character?.name ?? '',
    episodeTitle: episode?.title ?? '',
    episodeNumber: index >= 0 ? index + 1 : undefined,
    omitEmpty: settings.omitEmpty,
    template: settings.templates[presetId]
  });

  return { ...result, schema };
}

/**
 * Insert a rendered block at the cursor and, when live blocks are on, tag it.
 *
 * Returns `false` when the host refused the write — no active editor, or a view
 * whose schema doesn't carry the mark (the folder's continuous view). Silence
 * there would read as success, so every caller toasts on `false`.
 */
export function insertBlock(
  app: HostApi,
  settings: BlockSettings,
  episodeId: string,
  charId: string,
  presetId = settings.presetId
): boolean {
  const { text } = renderFor(app, settings, episodeId, charId, presetId);
  if (text.trim() === '') return false;

  const bid = newId('b');
  const attrs: StatusBlockAttrs = { bid, cid: charId, pid: presetId };

  // The plugin's own command, not `app.editor.insert`: it builds one paragraph
  // per line and applies the mark in the same transaction. See the command's
  // doc comment — going through `insert` collapses the newlines and leaves the
  // mark span guessed from a string length.
  if (app.editor.runCommand('insertStatusBlock', attrs, text, settings.liveBlocks)) {
    if (settings.liveBlocks) rememberBlock(app, episodeId, bid, { charId, presetId });
    return true;
  }

  // The command isn't in this view's schema (the folder's continuous view, say).
  // The block is still worth having, so fall back to the host's plain insert and
  // accept that it won't be live.
  return insertText(app, text);
}

/** Insert an already-rendered string (the system-message path). */
export function insertText(app: HostApi, text: string): boolean {
  if (text.trim() === '') return false;
  app.editor.insert(`${text}\n`);
  return true;
}

/**
 * Re-render every live block in the open episode.
 *
 * Returns how many were rewritten. Blocks whose character has since been deleted
 * are left alone rather than blanked — the writer's text is not ours to remove.
 */
export function refreshBlocks(app: HostApi, settings: BlockSettings, episodeId: string): number {
  const doc = readDoc(app);
  if (!doc) return 0;

  const found = collectBlocksFromDoc(doc);
  if (found.size === 0) return 0;

  pruneBlocks(app, episodeId, new Set(found.keys()));

  const known = readBlocks(app, episodeId);
  let count = 0;

  for (const [bid, attrs] of found) {
    const record = known[bid];
    const charId = attrs.cid || record?.charId;
    const presetId = attrs.pid || record?.presetId || settings.presetId;
    if (!charId) continue;

    const { text, error } = renderFor(app, settings, episodeId, charId, presetId);
    if (error || text.trim() === '') continue;

    if (app.editor.runCommand('replaceStatusBlock', bid, text)) count += 1;
  }
  return count;
}

/** Strip every live-block mark in the open editor, leaving the text. */
export function flattenBlocks(app: HostApi): boolean {
  return app.editor.runCommand('unmarkAllStatusBlocks');
}

/**
 * The block the cursor is inside, if any — drives the "edit this one" action on
 * the selection toolbar.
 */
export function blockAtSelection(app: HostApi): StatusBlockAttrs | undefined {
  const doc = readDoc(app);
  if (!doc) return undefined;
  const { from } = app.editor.getSelection();

  let hit: StatusBlockAttrs | undefined;
  walkText(doc, (node, pos) => {
    if (hit) return;
    const end = pos + nodeSize(node);
    if (from < pos || from > end) return;
    for (const mark of marksOf(node)) {
      if (markName(mark) === STATUS_MARK) {
        hit = markAttrs(mark);
        return;
      }
    }
  });
  return hit;
}

// ── the untyped doc walk ────────────────────────────────────────────────────
//
// `app.editor.getDoc()` is deliberately opaque in the SDK — the host does not
// promise a ProseMirror `Node`, only "the JSON shape `content(id).doc` also
// returns". So the reader below walks the JSON rather than casting to a PM type
// the host never agreed to hand over. It is a dozen lines and it cannot break
// when the host swaps its editor internals.

interface DocNode {
  type?: string;
  text?: string;
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
  content?: DocNode[];
}

function readDoc(app: HostApi): DocNode | undefined {
  try {
    const doc = app.editor.getDoc();
    return doc && typeof doc === 'object' ? (doc as DocNode) : undefined;
  } catch {
    return undefined;
  }
}

function walkText(node: DocNode, visit: (node: DocNode, pos: number) => void, start = 0): number {
  let pos = start;
  for (const child of node.content ?? []) {
    if (typeof child.text === 'string') {
      visit(child, pos);
      pos += child.text.length;
    } else {
      // +2 for the node's own open/close tokens, matching ProseMirror's
      // position arithmetic closely enough to locate a cursor within a block.
      pos = walkText(child, visit, pos + 1) + 1;
    }
  }
  return pos;
}

const nodeSize = (node: DocNode): number => node.text?.length ?? 0;
const marksOf = (node: DocNode) => node.marks ?? [];
const markName = (mark: { type?: string }): string => mark.type ?? '';
const markAttrs = (mark: { attrs?: Record<string, unknown> }): StatusBlockAttrs => ({
  bid: String(mark.attrs?.bid ?? ''),
  cid: String(mark.attrs?.cid ?? ''),
  pid: String(mark.attrs?.pid ?? '')
});

/** Every distinct block in the open document, from the JSON. */
function collectBlocksFromDoc(doc: DocNode): Map<string, StatusBlockAttrs> {
  const blocks = new Map<string, StatusBlockAttrs>();
  walkText(doc, (node) => {
    for (const mark of marksOf(node)) {
      if (markName(mark) !== STATUS_MARK) continue;
      const attrs = markAttrs(mark);
      if (attrs.bid && !blocks.has(attrs.bid)) blocks.set(attrs.bid, attrs);
    }
  });
  return blocks;
}

export { collectBlocks };
