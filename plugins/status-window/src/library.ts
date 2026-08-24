/**
 * The writer's own presets and attribute examples.
 *
 * ## Seeded, then owned
 *
 * `presets.ts` is starting content, not a fixed menu. The first read here copies
 * it into `app.storage`; after that the list belongs to the writer — add,
 * duplicate, edit, delete, reorder by deleting and re-adding. "Restore defaults"
 * copies the seed in again.
 *
 * A status window is a house style, and six transcriptions of other people's
 * serials are a good place to start and a bad place to stop. Anything the plugin
 * ships has to be something the writer can throw away.
 *
 * ## Why the whole list, not a diff
 *
 * The obvious storage shape is "the defaults, plus the writer's overrides". It
 * is the wrong one: a deleted default has to become a tombstone, an edited
 * default has to be diffed against a seed that may change in a later release,
 * and reordering has no representation at all. Storing the plain list makes
 * delete a splice and edit a replace, and the seed becomes what it should be —
 * initial data, with no authority afterwards.
 *
 * The cost is that new built-in presets in a future release don't appear for
 * existing users. That is the correct trade: silently re-adding something the
 * writer deleted is worse than not offering it.
 *
 * ## The attribute library belongs to a preset, not to the plugin
 *
 * It used to be one global list. That reads fine in storage and wrong on the
 * page: the library is the last section of the *preset editor*, under a preset
 * picker, beside four sections that are all per-preset — so deleting a row while
 * `한국식 · 헌터물` was selected silently emptied it for `일본식 · 미니멀` too. It
 * is also wrong on the merits. A preset is a whole convention, and `근력 (능력치)`
 * has no business in the picker while a Japanese sheet is the active one — which
 * is what {@link AttributeTemplate.family} was for and nothing ever read.
 *
 * So the list is keyed by preset. A preset with nothing stored seeds from its own
 * family; a writer who had already edited the old global list keeps it, copied
 * into every preset, because an upgrade that appears to delete their work is
 * worse than one that duplicates it.
 */
import type { HostApi } from '@pensiv/plugin-sdk';
import type { AttributeDef } from './model';
import { newId } from './model';
import {
  DEFAULT_ATTRIBUTE_TEMPLATES,
  DEFAULT_PRESET_ID,
  presetById,
  PRESETS,
  SYSTEM_PRESETS,
  type AttributeTemplate,
  type Preset,
  type SystemPreset
} from './presets';

const KEY_PRESETS = 'presetList';
const KEY_SYSTEM_PRESETS = 'systemPresetList';

/**
 * The pre-split global library. Read-only from here on: it is the seed for every
 * preset that has no list of its own, and nothing writes it again.
 */
const KEY_TEMPLATES_LEGACY = 'attributeTemplates';
const libraryKey = (presetId: string) => `attributeTemplates:${presetId}`;

/** Deep copy, so a seed value can't be mutated into the module's own constant. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function readList<T>(app: HostApi, key: string, seed: readonly T[]): T[] {
  const stored = app.storage.get<T[]>(key);
  if (Array.isArray(stored)) return stored;
  return clone(seed as T[]);
}

function writeList<T>(app: HostApi, key: string, list: readonly T[]): void {
  app.storage.set(key, list, { scope: 'synced' });
}

// ── block presets ───────────────────────────────────────────────────────────

export function listPresets(app: HostApi): Preset[] {
  return readList(app, KEY_PRESETS, PRESETS);
}

/**
 * One preset by id, falling back so a render never fails on a stale reference.
 *
 * A block in the prose carries the preset id it was written with, and the writer
 * may have deleted that preset since. Refusing to render would leave them
 * unable to refresh a block they can still see; rendering with whatever is left
 * keeps it working and looks like what it looks like.
 */
export function getPreset(app: HostApi, id: string): Preset {
  const list = listPresets(app);
  return (
    list.find((preset) => preset.id === id) ??
    list.find((preset) => preset.id === DEFAULT_PRESET_ID) ??
    list[0] ??
    (PRESETS[1] as Preset)
  );
}

export function savePreset(app: HostApi, preset: Preset): void {
  const list = listPresets(app);
  const index = list.findIndex((entry) => entry.id === preset.id);
  const next = [...list];
  if (index === -1) next.push(preset);
  else next[index] = preset;
  writeList(app, KEY_PRESETS, next);
}

export function deletePreset(app: HostApi, id: string): void {
  const list = listPresets(app);
  // Never leave the writer with none — an empty list has no valid default and
  // every render would fall through to the seed anyway.
  if (list.length <= 1) return;
  writeList(
    app,
    KEY_PRESETS,
    list.filter((preset) => preset.id !== id)
  );
  // Its library goes with it. Leaving the key behind would resurrect the old
  // list if the writer later recreated a preset with the same id.
  app.storage.set(libraryKey(id), undefined, { scope: 'synced' });
}

/**
 * Copy a preset under a new id, which is how a writer starts their own.
 *
 * The library comes along. "복제해서 이 프리셋의 변형을 만드세요" promises a copy of
 * the thing on screen, and the library is on screen — a duplicate that reverted
 * to the family seed would look like the copy had dropped half of it.
 */
export function duplicatePreset(app: HostApi, id: string, label: string): Preset {
  const source = getPreset(app, id);
  const copy: Preset = { ...clone(source), id: newId('p'), name: label };
  savePreset(app, copy);
  writeList(app, libraryKey(copy.id), clone(listAttributeTemplates(app, id)));
  return copy;
}

/**
 * Put one preset back to how it shipped, leaving every other preset alone.
 *
 * The button lives at the foot of *this* preset's template card, so this is what
 * it has to mean. Resetting the whole list from there threw away work on presets
 * the writer wasn't even looking at.
 */
export function restoreDefaultPreset(app: HostApi, id: string): void {
  const seed = PRESETS.find((preset) => preset.id === id);
  if (!seed) return;
  savePreset(app, clone(seed));
}

/** Whether this preset is a built-in, and so has defaults to go back to. */
export function hasDefaults(id: string): boolean {
  return PRESETS.some((preset) => preset.id === id);
}

export function restoreDefaultPresets(app: HostApi): void {
  writeList(app, KEY_PRESETS, clone(PRESETS));
}

// ── system-message presets ──────────────────────────────────────────────────

export function listSystemPresets(app: HostApi): SystemPreset[] {
  return readList(app, KEY_SYSTEM_PRESETS, SYSTEM_PRESETS);
}

export function getSystemPreset(app: HostApi, id: string): SystemPreset {
  const list = listSystemPresets(app);
  return list.find((preset) => preset.id === id) ?? list[0] ?? (SYSTEM_PRESETS[0] as SystemPreset);
}

export function saveSystemPreset(app: HostApi, preset: SystemPreset): void {
  const list = listSystemPresets(app);
  const index = list.findIndex((entry) => entry.id === preset.id);
  const next = [...list];
  if (index === -1) next.push(preset);
  else next[index] = preset;
  writeList(app, KEY_SYSTEM_PRESETS, next);
}

export function deleteSystemPreset(app: HostApi, id: string): void {
  const list = listSystemPresets(app);
  if (list.length <= 1) return;
  writeList(
    app,
    KEY_SYSTEM_PRESETS,
    list.filter((preset) => preset.id !== id)
  );
}

// ── the attribute library ───────────────────────────────────────────────────

/**
 * The rows a preset offers under "속성 추가" before the writer touches anything.
 *
 * Its own tradition's, which is the whole point of `family`: a Japanese sheet
 * offering `근력 (능력치)` is noise, and a picker of twenty rows from three
 * traditions is a list nobody scans.
 */
export function defaultLibraryFor(family: Preset['family']): AttributeTemplate[] {
  return DEFAULT_ATTRIBUTE_TEMPLATES.filter(
    (entry) => entry.family === family || entry.family === 'any'
  );
}

/** The family to seed from — the stored preset's, falling back to the shipped one. */
function familyOf(app: HostApi, presetId: string): Preset['family'] {
  const stored = listPresets(app).find((preset) => preset.id === presetId);
  return stored?.family ?? presetById(presetId).family;
}

/**
 * One preset's library.
 *
 * Three layers, most specific first: the preset's own stored list, then the
 * pre-split global list (so an upgrade doesn't look like it deleted the writer's
 * entries), then the family seed.
 */
export function listAttributeTemplates(app: HostApi, presetId: string): AttributeTemplate[] {
  const stored = app.storage.get<AttributeTemplate[]>(libraryKey(presetId));
  if (Array.isArray(stored)) return stored;

  const legacy = app.storage.get<AttributeTemplate[]>(KEY_TEMPLATES_LEGACY);
  if (Array.isArray(legacy)) return clone(legacy);

  return clone(defaultLibraryFor(familyOf(app, presetId)));
}

/**
 * Add a row the writer has already built to this preset's library.
 *
 * The entry point that makes this a library rather than a menu: the fastest way
 * to get `기술 (능력치, F–SSS)` into the picker is to have made one once.
 */
export function saveAttributeTemplate(
  app: HostApi,
  presetId: string,
  def: AttributeDef,
  label?: string
): void {
  const { id: _ignored, ...rest } = def;
  const entry: AttributeTemplate = {
    id: newId('t'),
    label: label ?? def.name,
    family: 'any',
    def: rest
  };
  writeList(app, libraryKey(presetId), [...listAttributeTemplates(app, presetId), entry]);
}

/** Replace a whole entry — the settings tab edits label, description and def. */
export function upsertAttributeTemplate(
  app: HostApi,
  presetId: string,
  entry: AttributeTemplate
): void {
  const list = listAttributeTemplates(app, presetId);
  const index = list.findIndex((existing) => existing.id === entry.id);
  const next = [...list];
  if (index === -1) next.push(entry);
  else next[index] = entry;
  writeList(app, libraryKey(presetId), next);
}

/**
 * Move an entry to a new position. Stored order *is* display order — the list
 * is the writer's, and "근력 above 민첩" is a choice worth keeping.
 *
 * `toIndex` is the insertion index in the list *without* the moved entry, which
 * is what a drag-and-drop drop line naturally produces.
 */
export function reorderAttributeTemplate(
  app: HostApi,
  presetId: string,
  id: string,
  toIndex: number
): void {
  const list = listAttributeTemplates(app, presetId);
  const index = list.findIndex((entry) => entry.id === id);
  if (index === -1) return;
  const next = [...list];
  const [moved] = next.splice(index, 1);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved as AttributeTemplate);
  writeList(app, libraryKey(presetId), next);
}

/**
 * Copy an entry under a new id, landing right below the original.
 *
 * `label` is the resolved display name plus the copy suffix — a plain string,
 * because from the moment of the copy the entry is the writer's, not ours to
 * translate.
 */
export function duplicateAttributeTemplate(
  app: HostApi,
  presetId: string,
  id: string,
  label: string
): AttributeTemplate | undefined {
  const list = listAttributeTemplates(app, presetId);
  const index = list.findIndex((entry) => entry.id === id);
  if (index === -1) return undefined;
  const copy: AttributeTemplate = { ...clone(list[index] as AttributeTemplate), id: newId('t'), label };
  const next = [...list];
  next.splice(index + 1, 0, copy);
  writeList(app, libraryKey(presetId), next);
  return copy;
}

export function deleteAttributeTemplate(app: HostApi, presetId: string, id: string): void {
  writeList(
    app,
    libraryKey(presetId),
    listAttributeTemplates(app, presetId).filter((entry) => entry.id !== id)
  );
}

export function restoreDefaultAttributeTemplates(app: HostApi, presetId: string): void {
  writeList(app, libraryKey(presetId), clone(defaultLibraryFor(familyOf(app, presetId))));
}

/** Mint a concrete row from a library entry. */
export function instantiate(entry: AttributeTemplate): AttributeDef {
  return { ...clone(entry.def), id: newId('a') };
}
