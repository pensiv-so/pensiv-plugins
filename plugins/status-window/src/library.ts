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
 */
import type { HostApi } from '@pensiv/plugin-sdk';
import type { AttributeDef } from './model';
import { newId } from './model';
import {
  DEFAULT_ATTRIBUTE_TEMPLATES,
  DEFAULT_PRESET_ID,
  PRESETS,
  SYSTEM_PRESETS,
  type AttributeTemplate,
  type Preset,
  type SystemPreset
} from './presets';

const KEY_PRESETS = 'presetList';
const KEY_SYSTEM_PRESETS = 'systemPresetList';
const KEY_TEMPLATES = 'attributeTemplates';

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
}

/** Copy a preset under a new id, which is how a writer starts their own. */
export function duplicatePreset(app: HostApi, id: string, label: string): Preset {
  const source = getPreset(app, id);
  const copy: Preset = { ...clone(source), id: newId('p'), name: label };
  savePreset(app, copy);
  return copy;
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

export function listAttributeTemplates(app: HostApi): AttributeTemplate[] {
  return readList(app, KEY_TEMPLATES, DEFAULT_ATTRIBUTE_TEMPLATES);
}

/**
 * Add a row the writer has already built to the library.
 *
 * The entry point that makes this a library rather than a menu: the fastest way
 * to get `기술 (능력치, F–SSS)` into the picker is to have made one once.
 */
export function saveAttributeTemplate(app: HostApi, def: AttributeDef, label?: string): void {
  const { id: _ignored, ...rest } = def;
  const entry: AttributeTemplate = {
    id: newId('t'),
    label: label ?? def.name,
    family: 'any',
    def: rest
  };
  writeList(app, KEY_TEMPLATES, [...listAttributeTemplates(app), entry]);
}

/** Replace a whole entry — the settings tab edits label, description and def. */
export function upsertAttributeTemplate(app: HostApi, entry: AttributeTemplate): void {
  const list = listAttributeTemplates(app);
  const index = list.findIndex((existing) => existing.id === entry.id);
  const next = [...list];
  if (index === -1) next.push(entry);
  else next[index] = entry;
  writeList(app, KEY_TEMPLATES, next);
}

/**
 * Move an entry to a new position. Stored order *is* display order — the list
 * is the writer's, and "근력 above 민첩" is a choice worth keeping.
 *
 * `toIndex` is the insertion index in the list *without* the moved entry, which
 * is what a drag-and-drop drop line naturally produces.
 */
export function reorderAttributeTemplate(app: HostApi, id: string, toIndex: number): void {
  const list = listAttributeTemplates(app);
  const index = list.findIndex((entry) => entry.id === id);
  if (index === -1) return;
  const next = [...list];
  const [moved] = next.splice(index, 1);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved as AttributeTemplate);
  writeList(app, KEY_TEMPLATES, next);
}

export function deleteAttributeTemplate(app: HostApi, id: string): void {
  writeList(
    app,
    KEY_TEMPLATES,
    listAttributeTemplates(app).filter((entry) => entry.id !== id)
  );
}

export function restoreDefaultAttributeTemplates(app: HostApi): void {
  writeList(app, KEY_TEMPLATES, clone(DEFAULT_ATTRIBUTE_TEMPLATES));
}

/** Mint a concrete row from a library entry. */
export function instantiate(entry: AttributeTemplate): AttributeDef {
  return { ...clone(entry.def), id: newId('a') };
}
