/**
 * Where the numbers live.
 *
 * ## One state per character, global
 *
 * A character's stats belong to the character, not to the file that happened to
 * be open when they were typed. Level 10 is level 10 in chapter 4, in chapter
 * 200, and on the character's own sheet.
 *
 * This used to be a per-episode delta store folded in episode order, and it was
 * wrong in a way writers hit immediately: values typed anywhere that is not a
 * *document* — a character sheet, most obviously, which is exactly where a
 * writer goes to fill in a character — landed under a key no fold ever read,
 * because `episodeOrder` lists documents only. The stats were on screen on the
 * sheet and gone in every chapter. Values written in one folder were also
 * invisible from another, and values written in chapter 12 invisible in chapter
 * 3, since a fold only ever carried forward.
 *
 * So: `values:<charId>` is the character's state, read identically from every
 * file. Writing a stat anywhere changes it everywhere.
 *
 * ## What the per-file keys are still for
 *
 * The growth arrow (`14 [F] → 16(+2)[F]`, the `{{changed}}` block, the dot on
 * the row) needs a baseline, and it should appear in the file where the writer
 * made the change and nowhere else. Two small per-file maps carry that:
 *
 *  - `delta:<fileId>:<charId>` — what this file set. Drives "carry over
 *    instead", which puts a value back to what it read before this file.
 *  - `prev:<fileId>:<charId>` — what those attributes read *before* this file
 *    first touched them. The arrow's left-hand side.
 *
 * Neither is ever folded into `values`. They are annotations on a global state,
 * not the state itself.
 *
 * ## Episode order is the app's, not ours
 *
 * Chapters are documents in the project tree and the app already orders them by
 * lexorank. Re-deriving that would be a second source of truth that drifts the
 * first time a writer drags a chapter. `episodeOrder` reads the tree. It no
 * longer decides what a status window *reads* — only the episode number a
 * template prints.
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
const valuesKey = (charId: string) => `values:${charId}`;
const deltaKey = (episodeId: string, charId: string) => `delta:${episodeId}:${charId}`;
const prevKey = (episodeId: string, charId: string) => `prev:${episodeId}:${charId}`;
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
 * Forget a local character, its sheet and its stats.
 *
 * The per-file `delta:` / `prev:` records are **not** swept: they are keyed by
 * file and there is no index of which files a character appears in, so a sweep
 * would mean reading every file's key. Nothing reads them once the character's
 * own state is gone.
 */
export function removeLocalCharacter(app: HostApi, id: string): void {
  if (!isLocalCharacter(id)) return;
  const locals = app.storage.get<Record<string, string>>(KEY_LOCAL_NAMES) ?? {};
  const next = { ...locals };
  delete next[id];
  app.storage.set(KEY_LOCAL_NAMES, next, { scope: 'synced' });
  app.storage.set(schemaKey(id), undefined, { scope: 'synced' });
  app.storage.set(valuesKey(id), undefined, { scope: 'synced' });
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

// ── the character's state ───────────────────────────────────────────────────

/** A map that is only worth a key while it has entries. */
function writeMap(app: HostApi, key: string, map: ValueMap): void {
  const empty = Object.keys(map).length === 0;
  app.storage.set(key, empty ? undefined : map, { scope: 'synced' });
}

/** What this file set for this character. */
export function readDelta(app: HostApi, episodeId: string, charId: string): ValueMap {
  return app.storage.get<ValueMap>(deltaKey(episodeId, charId)) ?? {};
}

/** What those attributes read before this file first touched them. */
export function readPrev(app: HostApi, episodeId: string, charId: string): ValueMap {
  return app.storage.get<ValueMap>(prevKey(episodeId, charId)) ?? {};
}

/**
 * Every file id in the project, depth-first. Any file type can parent any other
 * here, so the walk recurses into everything and collects everything.
 *
 * Only the one-time migration needs this; the render path never walks. Held per
 * host because the first render after an upgrade migrates *every* character,
 * and walking the tree once per character turns a project with fifty sheets
 * into fifty walks. Staleness can't matter: a file created after this ran has
 * no pre-upgrade values to find.
 */
const fileIdCache = new WeakMap<HostApi, string[]>();

function allFileIds(app: HostApi): string[] {
  const cached = fileIdCache.get(app);
  if (cached) return cached;

  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null): void => {
    for (const child of app.project.children(parentId)) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      if (!child.deletedAt) out.push(child.id);
      walk(child.id);
    }
  };
  walk(null);

  fileIdCache.set(app, out);
  return out;
}

/**
 * Rebuild a character's state from the per-episode deltas of the old model.
 *
 * Runs once per character, the first time anything asks for its values. Without
 * it the fix would read as data loss: every stat a writer had already typed
 * lives in a `delta:` key that nothing global would ever look at.
 *
 * Project order decides who wins a conflict, so chapter 12's figure beats
 * chapter 3's — the same thing "the latest state" meant before. The character's
 * own sheet is applied last on purpose: a sheet-backed character's own file is
 * the most deliberate statement of that character's numbers, and under the old
 * model it was also the one place the writer could type them and see nothing
 * anywhere else.
 *
 * Returns `undefined` when the project can't be read (no `project.read` grant,
 * or a host that predates the API), so the migration is retried later rather
 * than persisted half-done.
 */
function migrateFromDeltas(app: HostApi, charId: string): ValueMap | undefined {
  if (!app.project.available) return undefined;
  try {
    let merged: ValueMap = {};
    for (const fileId of allFileIds(app)) {
      merged = { ...merged, ...readDelta(app, fileId, charId) };
    }
    return { ...merged, ...readDelta(app, charId, charId) };
  } catch {
    return undefined;
  }
}

/** The character's stats, wherever the writer is. */
export function readValues(app: HostApi, charId: string): ValueMap {
  const stored = app.storage.get<ValueMap>(valuesKey(charId));
  if (stored) return stored;

  const migrated = migrateFromDeltas(app, charId);
  if (!migrated) return {};
  // Persisted even when empty — the stored `{}` is what stops the walk from
  // running again on every render.
  app.storage.set(valuesKey(charId), migrated, { scope: 'synced' });
  return migrated;
}

function writeValues(app: HostApi, charId: string, values: ValueMap): void {
  app.storage.set(valuesKey(charId), values, { scope: 'synced' });
}

/** Does this character have a status window filled in at all? */
export function hasValues(app: HostApi, charId: string): boolean {
  return Object.keys(readValues(app, charId)).length > 0;
}

export interface FoldResult {
  /** The character's state. The same everywhere. */
  values: ValueMap;
  /** What it read before this file touched it — the diff baseline. */
  previous: ValueMap;
  /** Position of `episodeId` in the order, or -1 when it isn't a listed episode. */
  index: number;
}

/**
 * The character's state, plus this file's baseline for the growth arrow.
 *
 * Two storage reads regardless of manuscript length — the old fold was linear
 * in the number of episodes.
 */
export function foldTo(
  app: HostApi,
  episodes: readonly ProjectFile[],
  episodeId: string,
  charId: string
): FoldResult {
  const index = episodes.findIndex((episode) => episode.id === episodeId);
  const values = readValues(app, charId);
  const previous = { ...values, ...readPrev(app, episodeId, charId) };
  return { values, previous, index };
}

/**
 * Set one attribute, for this character, everywhere.
 *
 * The per-file bookkeeping alongside it is what keeps the arrow honest: the
 * first edit in a file records what the attribute read on the way in, and
 * typing a stat up and back down again erases the record rather than leaving a
 * row marked "changed" while reading exactly as it did before.
 */
export function setValue(
  app: HostApi,
  episodeId: string,
  charId: string,
  attrId: string,
  value: AttributeValue
): void {
  const values = readValues(app, charId);
  const current = values[attrId];
  if (valuesEqual(value, current)) return;

  const prev = readPrev(app, episodeId, charId);
  const delta = readDelta(app, episodeId, charId);
  const nextPrev = { ...prev };
  const nextDelta = { ...delta };

  // The arrow's left-hand side: what this file found, not what it last wrote.
  const baseline = attrId in prev ? prev[attrId] : current;
  if (!(attrId in prev) && current !== undefined) nextPrev[attrId] = current;

  if (valuesEqual(value, baseline)) {
    delete nextPrev[attrId];
    delete nextDelta[attrId];
  } else {
    nextDelta[attrId] = value;
  }

  writeValues(app, charId, { ...values, [attrId]: value });
  writeMap(app, prevKey(episodeId, charId), nextPrev);
  writeMap(app, deltaKey(episodeId, charId), nextDelta);
}

/**
 * Undo this file's change to one attribute — "carry over instead".
 *
 * Puts the value back to what it read before this file touched it, which is a
 * global write like any other: the point of the button is that the number was
 * never meant to change here.
 */
export function clearValue(app: HostApi, episodeId: string, charId: string, attrId: string): void {
  const delta = readDelta(app, episodeId, charId);
  if (!(attrId in delta)) return;

  const prev = readPrev(app, episodeId, charId);
  const values = { ...readValues(app, charId) };
  if (attrId in prev) values[attrId] = prev[attrId] as AttributeValue;
  else delete values[attrId];

  const nextDelta = { ...delta };
  const nextPrev = { ...prev };
  delete nextDelta[attrId];
  delete nextPrev[attrId];

  writeValues(app, charId, values);
  writeMap(app, deltaKey(episodeId, charId), nextDelta);
  writeMap(app, prevKey(episodeId, charId), nextPrev);
}

/** Undo every change this file made to this character. */
export function clearEpisode(app: HostApi, episodeId: string, charId: string): void {
  for (const attrId of Object.keys(readDelta(app, episodeId, charId))) {
    clearValue(app, episodeId, charId, attrId);
  }
}

/**
 * Remove entries for attributes the sheet no longer defines.
 *
 * A rename in the editor keeps the id, so this only fires when a row is deleted
 * outright. Called after a schema edit rather than on a timer.
 *
 * The character's own state is what has to be cleaned; the per-file records are
 * swept for the episodes in scope as a courtesy, and anything left elsewhere is
 * inert — nothing reads a `delta:` or `prev:` entry whose attribute is gone.
 */
export function pruneDeltas(
  app: HostApi,
  episodes: readonly ProjectFile[],
  charId: string,
  schema: CharacterSchema
): void {
  const live = new Set(schema.attrs.map((attr) => attr.id));

  const keep = (map: ValueMap): ValueMap | undefined => {
    const kept: ValueMap = {};
    let dropped = false;
    for (const [attrId, value] of Object.entries(map)) {
      if (live.has(attrId)) kept[attrId] = value;
      else dropped = true;
    }
    return dropped ? kept : undefined;
  };

  const values = keep(readValues(app, charId));
  if (values) writeValues(app, charId, values);

  for (const episode of episodes) {
    const delta = keep(readDelta(app, episode.id, charId));
    if (delta) writeMap(app, deltaKey(episode.id, charId), delta);
    const prev = keep(readPrev(app, episode.id, charId));
    if (prev) writeMap(app, prevKey(episode.id, charId), prev);
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
