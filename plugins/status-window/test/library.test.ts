/**
 * Presets and attribute examples are seed data, not a fixed menu.
 *
 * The property that matters: anything the plugin ships can be edited or thrown
 * away, and nothing it ships comes back on its own.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { HostApi } from '@pensiv/plugin-sdk';
import {
  deleteAttributeTemplate,
  deletePreset,
  duplicateAttributeTemplate,
  duplicatePreset,
  getPreset,
  instantiate,
  listAttributeTemplates,
  listPresets,
  reorderAttributeTemplate,
  restoreDefaultAttributeTemplates,
  restoreDefaultPresets,
  saveAttributeTemplate,
  savePreset,
  upsertAttributeTemplate
} from '../src/library';
import { DEFAULT_ATTRIBUTE_TEMPLATES, PRESETS, presetById } from '../src/presets';

function fakeHost(): HostApi {
  const store = new Map<string, unknown>();
  return {
    storage: {
      get: <T>(key: string): T | undefined => store.get(key) as T | undefined,
      set: (key: string, value: unknown) => {
        if (value === undefined) store.delete(key);
        else store.set(key, value);
      },
      on: () => () => {}
    },
    app: { locale: 'ko' }
  } as unknown as HostApi;
}

let app: HostApi;
beforeEach(() => {
  app = fakeHost();
});

describe('presets are seeded then owned', () => {
  it('starts as a copy of the shipped set', () => {
    expect(listPresets(app).map((p) => p.id)).toEqual(PRESETS.map((p) => p.id));
  });

  /**
   * The seed is a module-level constant shared by every call. Handing it out by
   * reference would let one writer's edit mutate the defaults for the whole
   * session — including the copy `restoreDefaultPresets` puts back.
   */
  it('hands out a copy, not the module constant', () => {
    const list = listPresets(app);
    const first = list[0];
    if (!first) throw new Error('seed is empty');
    first.template = 'MUTATED';
    savePreset(app, first);

    expect(presetById(first.id).template).not.toBe('MUTATED');
    restoreDefaultPresets(app);
    expect(listPresets(app)[0]?.template).not.toBe('MUTATED');
  });

  it('keeps an edit', () => {
    const target = listPresets(app)[0];
    if (!target) throw new Error('seed is empty');
    savePreset(app, { ...target, template: 'CUSTOM', columns: 1 });

    const stored = getPreset(app, target.id);
    expect(stored.template).toBe('CUSTOM');
    expect(stored.columns).toBe(1);
  });

  it('deletes, and does not bring it back', () => {
    const target = listPresets(app)[0];
    if (!target) throw new Error('seed is empty');
    deletePreset(app, target.id);

    const ids = listPresets(app).map((p) => p.id);
    expect(ids).not.toContain(target.id);
    // Re-reading must not re-seed — that would make deletion look broken.
    expect(listPresets(app).map((p) => p.id)).toEqual(ids);
  });

  it('refuses to delete the last one', () => {
    for (const preset of listPresets(app)) deletePreset(app, preset.id);
    expect(listPresets(app)).toHaveLength(1);
  });

  it('duplicates under a new id', () => {
    const source = listPresets(app)[0];
    if (!source) throw new Error('seed is empty');
    const copy = duplicatePreset(app, source.id, '내 상태창');

    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe('내 상태창');
    expect(copy.template).toBe(source.template);
    expect(listPresets(app)).toHaveLength(PRESETS.length + 1);
  });

  /**
   * A block in the prose carries the preset id it was written with, and that
   * preset may since have been deleted. Refusing to render would leave the
   * writer unable to refresh a block they can still see.
   */
  it('falls back rather than failing on a deleted preset', () => {
    deletePreset(app, 'ko-hunter');
    expect(() => getPreset(app, 'ko-hunter')).not.toThrow();
    expect(getPreset(app, 'ko-hunter').id).toBeTruthy();
  });

  it('restores the shipped set', () => {
    deletePreset(app, 'ko-hunter');
    deletePreset(app, 'ja-classic');
    restoreDefaultPresets(app);
    expect(listPresets(app).map((p) => p.id)).toEqual(PRESETS.map((p) => p.id));
  });
});

describe('the attribute library', () => {
  it('starts as a copy of the shipped examples', () => {
    expect(listAttributeTemplates(app)).toHaveLength(DEFAULT_ATTRIBUTE_TEMPLATES.length);
  });

  it('adds a row the writer already built', () => {
    saveAttributeTemplate(app, {
      id: 'a-1',
      name: '기술',
      kind: 'stat',
      grades: ['F', 'E', 'D']
    });

    const added = listAttributeTemplates(app).at(-1);
    expect(added?.label).toBe('기술');
    expect(added?.def.name).toBe('기술');
    expect(added?.def.grades).toEqual(['F', 'E', 'D']);
    // The row's own id must not leak into the template — instantiating one has
    // to mint a fresh id, or two rows from the same entry would collide.
    expect(added?.def).not.toHaveProperty('id');
  });

  it('mints a fresh id per instantiation', () => {
    const entry = listAttributeTemplates(app)[0];
    if (!entry) throw new Error('library is empty');
    const a = instantiate(entry);
    const b = instantiate(entry);

    expect(a.id).not.toBe(b.id);
    expect(a.name).toBe(entry.def.name);
    expect(b.kind).toBe(entry.def.kind);
  });

  it('duplicates an entry right below the original, under a new id', () => {
    const source = listAttributeTemplates(app)[1];
    if (!source) throw new Error('library is empty');
    const copy = duplicateAttributeTemplate(app, source.id, '근력 복사본');
    if (!copy) throw new Error('duplicate returned nothing');

    const list = listAttributeTemplates(app);
    expect(list).toHaveLength(DEFAULT_ATTRIBUTE_TEMPLATES.length + 1);
    const at = list.findIndex((entry) => entry.id === copy.id);
    expect(at).toBe(2); // right below its source
    expect(copy.id).not.toBe(source.id);
    expect(copy.label).toBe('근력 복사본');
    expect(copy.def).toEqual(source.def);

    // A deep copy — editing the duplicate must not touch the original.
    upsertAttributeTemplate(app, { ...copy, def: { ...copy.def, name: '변경' } });
    const untouched = listAttributeTemplates(app).find((entry) => entry.id === source.id);
    expect(untouched?.def).toEqual(source.def);
  });

  it('duplicate of an unknown id is a no-op', () => {
    expect(duplicateAttributeTemplate(app, 'nope', 'x')).toBeUndefined();
    expect(listAttributeTemplates(app)).toHaveLength(DEFAULT_ATTRIBUTE_TEMPLATES.length);
  });

  it('deletes an example, permanently', () => {
    const target = listAttributeTemplates(app)[0];
    if (!target) throw new Error('library is empty');
    deleteAttributeTemplate(app, target.id);

    const ids = listAttributeTemplates(app).map((e) => e.id);
    expect(ids).not.toContain(target.id);
    expect(listAttributeTemplates(app).map((e) => e.id)).toEqual(ids);
  });

  it('can be emptied entirely — the bare kinds still exist in the picker', () => {
    for (const entry of listAttributeTemplates(app)) deleteAttributeTemplate(app, entry.id);
    expect(listAttributeTemplates(app)).toEqual([]);
  });

  it('restores the shipped examples', () => {
    for (const entry of listAttributeTemplates(app)) deleteAttributeTemplate(app, entry.id);
    restoreDefaultAttributeTemplates(app);
    expect(listAttributeTemplates(app)).toHaveLength(DEFAULT_ATTRIBUTE_TEMPLATES.length);
  });

  it('edits an entry in place — label, description and def together', () => {
    const target = listAttributeTemplates(app)[0];
    if (!target) throw new Error('library is empty');
    upsertAttributeTemplate(app, {
      ...target,
      label: '내 근력',
      description: '설명',
      def: { ...target.def, name: '완력' }
    });

    const stored = listAttributeTemplates(app)[0];
    expect(stored?.id).toBe(target.id);
    expect(stored?.label).toBe('내 근력');
    expect(stored?.description).toBe('설명');
    expect(stored?.def.name).toBe('완력');
    expect(listAttributeTemplates(app)).toHaveLength(DEFAULT_ATTRIBUTE_TEMPLATES.length);
  });

  /**
   * `toIndex` is the insertion index with the moved entry already lifted out —
   * what a drop line between rows naturally produces.
   */
  it('reorders to a drop index, both directions', () => {
    const before = listAttributeTemplates(app).map((e) => e.id);
    const [first, second, third] = before;
    if (!first || !second || !third) throw new Error('library too small');

    reorderAttributeTemplate(app, first, 2);
    expect(listAttributeTemplates(app).slice(0, 3).map((e) => e.id)).toEqual([
      second,
      third,
      first
    ]);

    reorderAttributeTemplate(app, first, 0);
    expect(listAttributeTemplates(app).map((e) => e.id)).toEqual(before);
  });

  it('reorder clamps out-of-range and ignores unknown ids', () => {
    const before = listAttributeTemplates(app).map((e) => e.id);
    reorderAttributeTemplate(app, 'no-such-id', 3);
    expect(listAttributeTemplates(app).map((e) => e.id)).toEqual(before);

    const first = before[0];
    if (!first) throw new Error('library is empty');
    reorderAttributeTemplate(app, first, 9999);
    expect(listAttributeTemplates(app).at(-1)?.id).toBe(first);
  });
});
