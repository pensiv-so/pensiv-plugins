/**
 * Presets and attribute examples are seed data, not a fixed menu.
 *
 * The property that matters: anything the plugin ships can be edited or thrown
 * away, and nothing it ships comes back on its own.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { HostApi } from '@pensiv/plugin-sdk';
import {
  defaultLibraryFor,
  deleteAttributeTemplate,
  deletePreset,
  duplicateAttributeTemplate,
  duplicatePreset,
  getPreset,
  hasDefaults,
  instantiate,
  listAttributeTemplates,
  listPresets,
  reorderAttributeTemplate,
  restoreDefaultAttributeTemplates,
  restoreDefaultPreset,
  restoreDefaultPresets,
  saveAttributeTemplate,
  savePreset,
  upsertAttributeTemplate
} from '../src/library';
import { DEFAULT_ATTRIBUTE_TEMPLATES, PRESETS, presetById } from '../src/presets';

/** Two built-ins from different traditions — the isolation tests need both. */
const KO = 'ko-hunter';
const JA = 'ja-classic';
/** How many rows a Korean preset's library starts with. */
const KO_SEED = defaultLibraryFor('ko').length;

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
  it('starts as a copy of its own tradition, not of all three', () => {
    const ko = listAttributeTemplates(app, KO);
    expect(ko).toHaveLength(KO_SEED);
    expect(ko.every((entry) => entry.family === 'ko' || entry.family === 'any')).toBe(true);
    // The whole shipped set spans three traditions; one preset gets its own.
    expect(ko.length).toBeLessThan(DEFAULT_ATTRIBUTE_TEMPLATES.length);
    expect(listAttributeTemplates(app, JA).every((e) => e.family === 'ja' || e.family === 'any')).toBe(
      true
    );
  });

  it('adds a row the writer already built', () => {
    saveAttributeTemplate(app, KO, {
      id: 'a-1',
      name: '기술',
      kind: 'stat',
      grades: ['F', 'E', 'D']
    });

    const added = listAttributeTemplates(app, KO).at(-1);
    expect(added?.label).toBe('기술');
    expect(added?.def.name).toBe('기술');
    expect(added?.def.grades).toEqual(['F', 'E', 'D']);
    // The row's own id must not leak into the template — instantiating one has
    // to mint a fresh id, or two rows from the same entry would collide.
    expect(added?.def).not.toHaveProperty('id');
  });

  it('mints a fresh id per instantiation', () => {
    const entry = listAttributeTemplates(app, KO)[0];
    if (!entry) throw new Error('library is empty');
    const a = instantiate(entry);
    const b = instantiate(entry);

    expect(a.id).not.toBe(b.id);
    expect(a.name).toBe(entry.def.name);
    expect(b.kind).toBe(entry.def.kind);
  });

  it('duplicates an entry right below the original, under a new id', () => {
    const source = listAttributeTemplates(app, KO)[1];
    if (!source) throw new Error('library is empty');
    const copy = duplicateAttributeTemplate(app, KO, source.id, '근력 복사본');
    if (!copy) throw new Error('duplicate returned nothing');

    const list = listAttributeTemplates(app, KO);
    expect(list).toHaveLength(KO_SEED + 1);
    const at = list.findIndex((entry) => entry.id === copy.id);
    expect(at).toBe(2); // right below its source
    expect(copy.id).not.toBe(source.id);
    expect(copy.label).toBe('근력 복사본');
    expect(copy.def).toEqual(source.def);

    // A deep copy — editing the duplicate must not touch the original.
    upsertAttributeTemplate(app, KO, { ...copy, def: { ...copy.def, name: '변경' } });
    const untouched = listAttributeTemplates(app, KO).find((entry) => entry.id === source.id);
    expect(untouched?.def).toEqual(source.def);
  });

  it('duplicate of an unknown id is a no-op', () => {
    expect(duplicateAttributeTemplate(app, KO, 'nope', 'x')).toBeUndefined();
    expect(listAttributeTemplates(app, KO)).toHaveLength(KO_SEED);
  });

  it('deletes an example, permanently', () => {
    const target = listAttributeTemplates(app, KO)[0];
    if (!target) throw new Error('library is empty');
    deleteAttributeTemplate(app, KO, target.id);

    const ids = listAttributeTemplates(app, KO).map((e) => e.id);
    expect(ids).not.toContain(target.id);
    expect(listAttributeTemplates(app, KO).map((e) => e.id)).toEqual(ids);
  });

  it('can be emptied entirely — the bare kinds still exist in the picker', () => {
    for (const entry of listAttributeTemplates(app, KO)) deleteAttributeTemplate(app, KO, entry.id);
    expect(listAttributeTemplates(app, KO)).toEqual([]);
  });

  it('restores the shipped examples', () => {
    for (const entry of listAttributeTemplates(app, KO)) deleteAttributeTemplate(app, KO, entry.id);
    restoreDefaultAttributeTemplates(app, KO);
    expect(listAttributeTemplates(app, KO)).toHaveLength(KO_SEED);
  });

  it('edits an entry in place — label, description and def together', () => {
    const target = listAttributeTemplates(app, KO)[0];
    if (!target) throw new Error('library is empty');
    upsertAttributeTemplate(app, KO, {
      ...target,
      label: '내 근력',
      description: '설명',
      def: { ...target.def, name: '완력' }
    });

    const stored = listAttributeTemplates(app, KO)[0];
    expect(stored?.id).toBe(target.id);
    expect(stored?.label).toBe('내 근력');
    expect(stored?.description).toBe('설명');
    expect(stored?.def.name).toBe('완력');
    expect(listAttributeTemplates(app, KO)).toHaveLength(KO_SEED);
  });

  /**
   * `toIndex` is the insertion index with the moved entry already lifted out —
   * what a drop line between rows naturally produces.
   */
  it('reorders to a drop index, both directions', () => {
    const before = listAttributeTemplates(app, KO).map((e) => e.id);
    const [first, second, third] = before;
    if (!first || !second || !third) throw new Error('library too small');

    reorderAttributeTemplate(app, KO, first, 2);
    expect(listAttributeTemplates(app, KO).slice(0, 3).map((e) => e.id)).toEqual([
      second,
      third,
      first
    ]);

    reorderAttributeTemplate(app, KO, first, 0);
    expect(listAttributeTemplates(app, KO).map((e) => e.id)).toEqual(before);
  });

  it('reorder clamps out-of-range and ignores unknown ids', () => {
    const before = listAttributeTemplates(app, KO).map((e) => e.id);
    reorderAttributeTemplate(app, KO, 'no-such-id', 3);
    expect(listAttributeTemplates(app, KO).map((e) => e.id)).toEqual(before);

    const first = before[0];
    if (!first) throw new Error('library is empty');
    reorderAttributeTemplate(app, KO, first, 9999);
    expect(listAttributeTemplates(app, KO).at(-1)?.id).toBe(first);
  });
});

/**
 * Reported 2026-08: "한 프리셋의 변경사항이 다른 프리셋에도 전부 반영되는 문제가
 * 있습니다." The screen recording empties the attribute library under
 * `한국식 · 헌터물 · 기본`, switches to `한국식 · 게임판타지`, and finds that one
 * empty too.
 *
 * The library is the last section of the preset editor, under the preset picker,
 * beside four sections that are all per-preset. Whatever storage wants, the page
 * promises the list belongs to the preset above it.
 */
describe('one preset’s edits stay in that preset', () => {
  it('deleting every row under one preset leaves the others full', () => {
    for (const entry of listAttributeTemplates(app, KO)) deleteAttributeTemplate(app, KO, entry.id);

    expect(listAttributeTemplates(app, KO)).toEqual([]);
    expect(listAttributeTemplates(app, JA).length).toBeGreaterThan(0);
    expect(listAttributeTemplates(app, 'ko-classic').length).toBeGreaterThan(0);
  });

  it('adding, editing and reordering are all scoped to one preset', () => {
    const koBefore = listAttributeTemplates(app, KO).map((e) => e.id);
    const jaBefore = listAttributeTemplates(app, JA).map((e) => e.id);

    saveAttributeTemplate(app, JA, { id: 'a-1', name: '腕力', kind: 'stat' });
    const target = listAttributeTemplates(app, JA)[0];
    if (!target) throw new Error('library is empty');
    upsertAttributeTemplate(app, JA, { ...target, label: '編集済み' });
    reorderAttributeTemplate(app, JA, target.id, 2);

    expect(listAttributeTemplates(app, KO).map((e) => e.id)).toEqual(koBefore);
    expect(listAttributeTemplates(app, JA).map((e) => e.id)).not.toEqual(jaBefore);
    expect(listAttributeTemplates(app, KO).some((e) => e.label === '編集済み')).toBe(false);
  });

  it('restoring one preset’s library does not restore another’s', () => {
    for (const entry of listAttributeTemplates(app, KO)) deleteAttributeTemplate(app, KO, entry.id);
    for (const entry of listAttributeTemplates(app, JA)) deleteAttributeTemplate(app, JA, entry.id);

    restoreDefaultAttributeTemplates(app, KO);
    expect(listAttributeTemplates(app, KO)).toHaveLength(KO_SEED);
    expect(listAttributeTemplates(app, JA)).toEqual([]);
  });

  /**
   * The button is at the foot of one preset's template card. It used to call
   * `restoreDefaultPresets` and take every other preset with it.
   */
  it('restoring one preset’s template leaves the other presets edited', () => {
    savePreset(app, { ...getPreset(app, KO), template: 'HUNTER' });
    savePreset(app, { ...getPreset(app, JA), template: 'JA' });

    restoreDefaultPreset(app, KO);

    expect(getPreset(app, KO).template).toBe(presetById(KO).template);
    expect(getPreset(app, JA).template).toBe('JA');
  });

  it('a writer-made preset has no shipped version to restore', () => {
    const mine = duplicatePreset(app, KO, '내 상태창');
    expect(hasDefaults(mine.id)).toBe(false);
    expect(hasDefaults(KO)).toBe(true);

    savePreset(app, { ...getPreset(app, mine.id), template: 'MINE' });
    restoreDefaultPreset(app, mine.id); // no-op rather than a wipe
    expect(getPreset(app, mine.id).template).toBe('MINE');
  });

  /** A duplicate copies what is on screen, library included — then diverges. */
  it('a duplicated preset inherits the library, then goes its own way', () => {
    const target = listAttributeTemplates(app, KO)[0];
    if (!target) throw new Error('library is empty');
    upsertAttributeTemplate(app, KO, { ...target, label: '내 근력' });

    const copy = duplicatePreset(app, KO, '내 상태창');
    expect(listAttributeTemplates(app, copy.id).map((e) => e.id)).toEqual(
      listAttributeTemplates(app, KO).map((e) => e.id)
    );
    expect(listAttributeTemplates(app, copy.id)[0]?.label).toBe('내 근력');

    deleteAttributeTemplate(app, copy.id, target.id);
    expect(listAttributeTemplates(app, KO).some((e) => e.id === target.id)).toBe(true);
  });

  it('deleting a preset takes its library with it', () => {
    const copy = duplicatePreset(app, KO, '버릴 것');
    for (const entry of listAttributeTemplates(app, copy.id)) {
      deleteAttributeTemplate(app, copy.id, entry.id);
    }
    expect(listAttributeTemplates(app, copy.id)).toEqual([]);

    deletePreset(app, copy.id);
    // A preset recreated under the same id must not inherit the dead one's list.
    savePreset(app, { ...presetById(KO), id: copy.id, name: '다시' });
    expect(listAttributeTemplates(app, copy.id)).toHaveLength(KO_SEED);
  });

  /**
   * Upgrade path. A writer who had already edited the single global list keeps
   * it — copied into every preset — because an upgrade that looks like it
   * deleted their work is worse than one that duplicates it.
   */
  describe('upgrading from the single global library', () => {
    it('carries the old list into every preset', () => {
      app.storage.set('attributeTemplates', [
        { id: 't-mine', label: '내 것', family: 'any', def: { name: '내 것', kind: 'stat' } }
      ]);

      expect(listAttributeTemplates(app, KO).map((e) => e.id)).toEqual(['t-mine']);
      expect(listAttributeTemplates(app, JA).map((e) => e.id)).toEqual(['t-mine']);
    });

    it('and from the first edit onward the presets are independent', () => {
      app.storage.set('attributeTemplates', [
        { id: 't-mine', label: '내 것', family: 'any', def: { name: '내 것', kind: 'stat' } },
        { id: 't-other', label: '다른 것', family: 'any', def: { name: '다른 것', kind: 'text' } }
      ]);

      deleteAttributeTemplate(app, KO, 't-mine');

      expect(listAttributeTemplates(app, KO).map((e) => e.id)).toEqual(['t-other']);
      expect(listAttributeTemplates(app, JA).map((e) => e.id)).toEqual(['t-mine', 't-other']);
      // And the legacy key is left alone, so a rollback still has the data.
      expect(app.storage.get<unknown[]>('attributeTemplates')).toHaveLength(2);
    });
  });
});
