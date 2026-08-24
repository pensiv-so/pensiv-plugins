/**
 * Where the numbers live, and how "her stats at chapter 31" becomes a lookup.
 *
 * ## Deltas, not snapshots
 *
 * The obvious design stores a full value map per episode. It works until the
 * writer asks the question every spreadsheet fails at — *what did this look like
 * forty chapters ago?* — or edits chapter 12 and needs 13 through 200 to follow.
 *
 * So an episode stores **only what changed in it**. A character's state at any
 * point is the fold of every delta from the first episode to that one. This
 * buys, in one move:
 *
 *  - **arbitrary-point state** — fold to any index, no extra bookkeeping;
 *  - **downstream recalculation** — edit an early episode and every later fold
 *    already includes it, because nothing downstream was ever a copy;
 *  - **a storage budget that scales with edits, not with length** — 300 chapters
 *    × 10 characters is a few hundred changed fields, not 3,000 full sheets;
 *  - **the growth arrow for free** — `previous` is the fold one episode back,
 *    so `14 [F] → 16(+2)[F]` is read, not computed against a guess.
 *
 * ## Episode order is the app's, not ours
 *
 * Chapters are documents in the project tree and the app already orders them by
 * lexorank. Re-deriving that would be a second source of truth that drifts the
 * first time a writer drags a chapter. `episodeOrder` reads the tree.
 *
 * ## Everything is synced
 *
 * `app.storage` with `scope: 'synced'` rides the app's own settings sync, so a
 * stat typed on the laptop is on the phone. The plugin's namespace is its own —
 * keys here can't collide with another plugin's.
 */
import type { HostApi, ProjectFile } from '@pensiv/plugin-sdk';
import {
  isLocalCharacter,
  LOCAL_PREFIX,
  newId,
  valuesEqual,
  type AttributeValue,
  type Character,
  type CharacterSchema,
  type ValueMap
} from './model';
import { presetById, type Preset } from './presets';

const KEY_LOCAL_NAMES = 'localCharacters';
const schemaKey = (charId: string) => `schema:${charId}`;
const deltaKey = (episodeId: string, charId: string) => `delta:${episodeId}:${charId}`;
const blocksKey = (episodeId: string) => `blocks:${episodeId}`;

/** How far back the episode list reaches. */
export type EpisodeScope = 'folder' | 'project';

// ── characters ──────────────────────────────────────────────────────────────

/**
 * Every character the writer can pick.
 *
 * Two sources, merged: sheets in the project (so a manuscript that already keeps
 * character sheets needs no setup at all) and characters that exist only here
 * (so one that doesn't isn't forced to create five files before trying the
 * plugin). Project titles win for sheet-backed entries — renaming the sheet
 * renames the character, which is the behaviour a writer expects.
 */
export function readCharacters(app: HostApi): Character[] {
  const locals = app.storage.get<Record<string, string>>(KEY_LOCAL_NAMES) ?? {};
  const localList: Character[] = Object.entries(locals).map(([id, name]) => ({ id, name }));

  if (!app.project.available) return localList;

  let sheets: ProjectFile[] = [];
  try {
    sheets = app.project.query({ type: 'sheet' });
  } catch {
    // No `project.read` grant, or a host that predates the project API. The
    // plugin still works on its own characters.
    return localList;
  }

  const fromProject: Character[] = sheets
    .filter((sheet) => !sheet.deletedAt)
    .map((sheet) => ({
      id: sheet.id,
      name: sheet.title || '—',
      fileId: sheet.id,
      icon: sheet.icon,
      sheetCategory: sheet.sheetCategory,
      portraitUrl: sheet.portraitUrl
    }));

  return [...fromProject, ...localList];
}

/**
 * The character a freshly opened pane is about.
 *
 * Sheet-backed characters *are* project files, so when the open file is one of
 * them the answer is already on screen: the writer is looking at 무진's sheet and
 * wants 무진's numbers, not whichever character happens to sort first. Falling
 * back to `[0]` meant picking `세계관` — the first sheet in the project — every
 * time, and re-picking by hand on every open.
 *
 * Returns `undefined` only when there are no characters at all.
 */
export function defaultCharacterId(
  characters: readonly Character[],
  fileId: string | undefined
): string | undefined {
  if (fileId && characters.some((character) => character.id === fileId)) return fileId;
  return characters[0]?.id;
}

/** Add a character that lives only in the plugin. Returns its id. */
export function addLocalCharacter(app: HostApi, name: string): string {
  const id = `${LOCAL_PREFIX}${newId('c')}`;
  const locals = app.storage.get<Record<string, string>>(KEY_LOCAL_NAMES) ?? {};
  app.storage.set(KEY_LOCAL_NAMES, { ...locals, [id]: name }, { scope: 'synced' });
  return id;
}

export function renameLocalCharacter(app: HostApi, id: string, name: string): void {
  if (!isLocalCharacter(id)) return;
  const locals = app.storage.get<Record<string, string>>(KEY_LOCAL_NAMES) ?? {};
  app.storage.set(KEY_LOCAL_NAMES, { ...locals, [id]: name }, { scope: 'synced' });
}

/**
 * Forget a local character and its sheet.
 *
 * Its per-episode deltas are **not** swept: they are keyed by episode and there
 * is no index of which episodes a character appears in, so a sweep would mean
 * reading every episode's key. They are inert once the character is gone, and
 * `pruneDeltas` clears them if the writer ever asks.
 */
export function removeLocalCharacter(app: HostApi, id: string): void {
  if (!isLocalCharacter(id)) return;
  const locals = app.storage.get<Record<string, string>>(KEY_LOCAL_NAMES) ?? {};
  const next = { ...locals };
  delete next[id];
  app.storage.set(KEY_LOCAL_NAMES, next, { scope: 'synced' });
  app.storage.set(schemaKey(id), undefined, { scope: 'synced' });
}

// ── the sheet's shape ───────────────────────────────────────────────────────

/**
 * A character's attribute definitions, seeded from a preset the first time.
 *
 * Seeding is the difference between a plugin someone tries and one someone uses:
 * an empty sheet asks the writer to type seventeen Korean stat names before
 * seeing anything at all.
 */
export function readSchema(app: HostApi, charId: string, seedFrom?: Preset): CharacterSchema {
  const stored = app.storage.get<CharacterSchema>(schemaKey(charId));
  if (stored && Array.isArray(stored.attrs)) return stored;

  const preset = seedFrom ?? presetById('ko-hunter');
  return { groups: [...preset.groups], attrs: [...preset.fields] };
}

export function writeSchema(app: HostApi, charId: string, schema: CharacterSchema): void {
  app.storage.set(schemaKey(charId), schema, { scope: 'synced' });
}

/** Whether this character has a sheet of its own yet, or is still on a preset's. */
export function hasSchema(app: HostApi, charId: string): boolean {
  return app.storage.get<CharacterSchema>(schemaKey(charId)) !== undefined;
}

// ── episodes ────────────────────────────────────────────────────────────────

/**
 * The chapters, in reading order.
 *
 * `folder` is the sibling list — right for a manuscript with one chapter folder,
 * and the default because it is also the cheap one. `project` walks the whole
 * tree depth-first, which is what a book split into parts needs. Any file type
 * can parent any other in this app, so the walk recurses into everything and
 * only *collects* documents.
 */
export function episodeOrder(app: HostApi, scope: EpisodeScope, currentId?: string): ProjectFile[] {
  if (!app.project.available) return [];

  try {
    if (scope === 'folder') {
      const current = currentId ? app.project.get(currentId) : undefined;
      const parentId = current?.parentId ?? null;
      return app.project.children(parentId).filter((file) => file.type === 'document' && !file.deletedAt);
    }

    const out: ProjectFile[] = [];
    const seen = new Set<string>();
    const walk = (parentId: string | null): void => {
      for (const child of app.project.children(parentId)) {
        if (child.deletedAt || seen.has(child.id)) continue;
        seen.add(child.id);
        if (child.type === 'document') out.push(child);
        // Recurse regardless of type: a canvas or a sheet can hold documents.
        walk(child.id);
      }
    };
    walk(null);
    return out;
  } catch {
    return [];
  }
}

// ── deltas and the fold ─────────────────────────────────────────────────────

/** What changed in one episode for one character. */
export function readDelta(app: HostApi, episodeId: string, charId: string): ValueMap {
  return app.storage.get<ValueMap>(deltaKey(episodeId, charId)) ?? {};
}

function writeDelta(app: HostApi, episodeId: string, charId: string, delta: ValueMap): void {
  const empty = Object.keys(delta).length === 0;
  app.storage.set(deltaKey(episodeId, charId), empty ? undefined : delta, { scope: 'synced' });
}

/** Does this character have anything written in this episode? */
export function hasEntry(app: HostApi, episodeId: string, charId: string): boolean {
  return Object.keys(readDelta(app, episodeId, charId)).length > 0;
}

export interface FoldResult {
  /** State at the end of `episodeId`. */
  values: ValueMap;
  /** State at the end of the episode before it — the diff baseline. */
  previous: ValueMap;
  /** Position of `episodeId` in the order, or -1 when it isn't a listed episode. */
  index: number;
}

/**
 * Fold every delta up to and including `episodeId`.
 *
 * Linear in the number of episodes, and each step is a synchronous storage read
 * of a small object — a 300-chapter manuscript folds in well under a frame. It
 * is called on render, not on keystroke; the pane holds the result.
 */
export function foldTo(
  app: HostApi,
  episodes: readonly ProjectFile[],
  episodeId: string,
  charId: string
): FoldResult {
  const index = episodes.findIndex((episode) => episode.id === episodeId);

  // An episode outside the configured scope (a scratch file, a different
  // folder) still gets to carry a status window: everything before it folds,
  // and its own delta applies on top.
  const upto = index === -1 ? episodes.length : index;

  let previous: ValueMap = {};
  for (let i = 0; i < upto; i += 1) {
    const episode = episodes[i];
    if (!episode) continue;
    previous = { ...previous, ...readDelta(app, episode.id, charId) };
  }

  const values = { ...previous, ...readDelta(app, episodeId, charId) };
  return { values, previous, index };
}

/**
 * Record a value for one attribute in one episode.
 *
 * Writes to the delta **only when the value differs from what carries forward**;
 * setting a stat back to the inherited figure removes the entry rather than
 * storing a no-op. That is what keeps the store proportional to edits, and it
 * keeps `changed` honest — a row that reads the same as last chapter should not
 * appear in the growth list.
 */
export function setValue(
  app: HostApi,
  episodeId: string,
  charId: string,
  attrId: string,
  value: AttributeValue,
  inherited: AttributeValue | undefined
): void {
  const delta = readDelta(app, episodeId, charId);
  const next = { ...delta };

  if (valuesEqual(value, inherited)) {
    delete next[attrId];
  } else {
    next[attrId] = value;
  }
  writeDelta(app, episodeId, charId, next);
}

/** Drop one attribute's entry for this episode — "inherit from the last one". */
export function clearValue(app: HostApi, episodeId: string, charId: string, attrId: string): void {
  const delta = readDelta(app, episodeId, charId);
  if (!(attrId in delta)) return;
  const next = { ...delta };
  delete next[attrId];
  writeDelta(app, episodeId, charId, next);
}

/** Drop everything this character has in this episode. */
export function clearEpisode(app: HostApi, episodeId: string, charId: string): void {
  writeDelta(app, episodeId, charId, {});
}

/**
 * Remove delta entries for attributes the sheet no longer defines.
 *
 * A rename in the editor keeps the id, so this only fires when a row is deleted
 * outright. Called after a schema edit rather than on a timer.
 */
export function pruneDeltas(
  app: HostApi,
  episodes: readonly ProjectFile[],
  charId: string,
  schema: CharacterSchema
): void {
  const live = new Set(schema.attrs.map((attr) => attr.id));
  for (const episode of episodes) {
    const delta = readDelta(app, episode.id, charId);
    const kept: ValueMap = {};
    let dropped = false;
    for (const [attrId, value] of Object.entries(delta)) {
      if (live.has(attrId)) kept[attrId] = value;
      else dropped = true;
    }
    if (dropped) writeDelta(app, episode.id, charId, kept);
  }
}

// ── the register of live blocks ─────────────────────────────────────────────

/** What a `statusBlock` mark in the prose points at. */
export interface BlockRecord {
  charId: string;
  presetId: string;
}

export function readBlocks(app: HostApi, episodeId: string): Record<string, BlockRecord> {
  return app.storage.get<Record<string, BlockRecord>>(blocksKey(episodeId)) ?? {};
}

export function rememberBlock(
  app: HostApi,
  episodeId: string,
  blockId: string,
  record: BlockRecord
): void {
  const blocks = readBlocks(app, episodeId);
  app.storage.set(blocksKey(episodeId), { ...blocks, [blockId]: record }, { scope: 'synced' });
}

/**
 * Forget blocks whose marks are gone from the prose.
 *
 * The marks are the source of truth — deleting the paragraph deletes the block,
 * and this register only exists so a refresh knows which character each one was
 * for. Called with the ids actually found in the document.
 */
export function pruneBlocks(app: HostApi, episodeId: string, liveIds: ReadonlySet<string>): void {
  const blocks = readBlocks(app, episodeId);
  const kept: Record<string, BlockRecord> = {};
  let dropped = false;
  for (const [id, record] of Object.entries(blocks)) {
    if (liveIds.has(id)) kept[id] = record;
    else dropped = true;
  }
  if (dropped) app.storage.set(blocksKey(episodeId), kept, { scope: 'synced' });
}
