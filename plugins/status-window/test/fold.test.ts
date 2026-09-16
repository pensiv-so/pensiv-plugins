/**
 * The character's state, and the per-document record that draws the arrow.
 *
 * Two properties matter and both are tested here: a stat written anywhere reads
 * the same everywhere — including from a file that is not an episode at all,
 * which is where this plugin used to lose the writer's numbers — and the growth
 * arrow still only appears in the document where the change was made.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { HostApi, ProjectFile } from '@pensiv/plugin-sdk';
import {
  clearEpisode,
  clearValue,
  foldTo,
  hasValues,
  pruneDeltas,
  readDelta,
  readPrev,
  readValues,
  setValue
} from '../src/storage';
import type { AttributeValue, CharacterSchema } from '../src/model';

/** A `HostApi` with only the surface `storage.ts` touches. */
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
    project: { available: false }
  } as unknown as HostApi;
}

const episode = (id: string): ProjectFile =>
  ({ id, type: 'document', title: id }) as unknown as ProjectFile;

const EPISODES = [episode('ep1'), episode('ep2'), episode('ep3'), episode('ep4')];
const CHAR = 'c1';
const stat = (base: number): AttributeValue => ({ kind: 'stat', base });

let app: HostApi;
beforeEach(() => {
  app = fakeHost();
});

describe('foldTo', () => {
  it('is empty before anything is written', () => {
    const { values, previous } = foldTo(app, EPISODES, 'ep1', CHAR);
    expect(values).toEqual({});
    expect(previous).toEqual({});
  });

  it('reads the same value from every episode', () => {
    setValue(app, 'ep1', CHAR, 'str', stat(10));

    expect(foldTo(app, EPISODES, 'ep1', CHAR).values).toEqual({ str: stat(10) });
    expect(foldTo(app, EPISODES, 'ep3', CHAR).values).toEqual({ str: stat(10) });
  });

  /** Editing chapter 12 is not a fact about chapters 13 onward. */
  it('reads a later edit from an earlier episode too', () => {
    setValue(app, 'ep1', CHAR, 'str', stat(10));
    setValue(app, 'ep3', CHAR, 'str', stat(30));

    expect(foldTo(app, EPISODES, 'ep1', CHAR).values).toEqual({ str: stat(30) });
    expect(foldTo(app, EPISODES, 'ep2', CHAR).values).toEqual({ str: stat(30) });
    expect(foldTo(app, EPISODES, 'ep4', CHAR).values).toEqual({ str: stat(30) });
  });

  /**
   * The bug this model exists to fix: a character sheet is not a document, so
   * it was never in the episode order, so everything typed on it was invisible
   * from every chapter.
   */
  it('reads values written on a file that is not an episode', () => {
    setValue(app, 'sheet-b', CHAR, 'str', stat(7));

    expect(foldTo(app, EPISODES, 'ep1', CHAR).values).toEqual({ str: stat(7) });
    expect(foldTo(app, EPISODES, 'ep4', CHAR).values).toEqual({ str: stat(7) });
    expect(hasValues(app, CHAR)).toBe(true);
  });

  it('exposes what the document found as the diff baseline', () => {
    setValue(app, 'ep1', CHAR, 'str', stat(10));
    setValue(app, 'ep3', CHAR, 'str', stat(30));

    // ep3 changed it, so ep3 draws the arrow.
    const at3 = foldTo(app, EPISODES, 'ep3', CHAR);
    expect(at3.previous).toEqual({ str: stat(10) });
    expect(at3.values).toEqual({ str: stat(30) });

    // ep4 didn't touch it, so its baseline equals its state — the growth arrow
    // collapses to a plain value, which is what the template relies on.
    const at4 = foldTo(app, EPISODES, 'ep4', CHAR);
    expect(at4.previous).toEqual(at4.values);
  });

  it('merges independent attributes written in different documents', () => {
    setValue(app, 'ep1', CHAR, 'str', stat(10));
    setValue(app, 'ep2', CHAR, 'agi', stat(5));
    setValue(app, 'sheet-b', CHAR, 'str', stat(12));

    expect(foldTo(app, EPISODES, 'ep3', CHAR).values).toEqual({ str: stat(12), agi: stat(5) });
  });

  it('reports the episode index, and -1 for a file outside the scope', () => {
    expect(foldTo(app, EPISODES, 'ep3', CHAR).index).toBe(2);
    expect(foldTo(app, EPISODES, 'stray', CHAR).index).toBe(-1);
  });

  it('keeps characters apart', () => {
    setValue(app, 'ep1', CHAR, 'str', stat(10));
    expect(foldTo(app, EPISODES, 'ep2', 'other').values).toEqual({});
  });
});

describe('setValue', () => {
  it('stores nothing when the value already reads that way', () => {
    setValue(app, 'ep2', CHAR, 'str', stat(10));
    setValue(app, 'ep2', CHAR, 'str', stat(10));

    expect(readValues(app, CHAR)).toEqual({ str: stat(10) });
    // First write against no baseline: nothing to draw an arrow from.
    expect(readPrev(app, 'ep2', CHAR)).toEqual({});
  });

  it('records what the document found, so the arrow has a left-hand side', () => {
    setValue(app, 'ep1', CHAR, 'str', stat(10));
    setValue(app, 'ep2', CHAR, 'str', stat(11));

    expect(readPrev(app, 'ep2', CHAR)).toEqual({ str: stat(10) });
    expect(readDelta(app, 'ep2', CHAR)).toEqual({ str: stat(11) });
    // ep1 introduced the attribute, so it owns that change and can undo it —
    // but with nothing before it there is no arrow to draw.
    expect(readDelta(app, 'ep1', CHAR)).toEqual({ str: stat(10) });
    expect(readPrev(app, 'ep1', CHAR)).toEqual({});

    const at1 = foldTo(app, EPISODES, 'ep1', CHAR);
    expect(at1.previous).toEqual(at1.values);
  });

  /**
   * Typing a stat up and back down again must leave no trace — otherwise the
   * row shows up as "changed" while reading exactly as it did before.
   */
  it('erases the record when the value is set back', () => {
    setValue(app, 'ep1', CHAR, 'str', stat(10));
    setValue(app, 'ep2', CHAR, 'str', stat(11));
    setValue(app, 'ep2', CHAR, 'str', stat(10));

    expect(readDelta(app, 'ep2', CHAR)).toEqual({});
    expect(readPrev(app, 'ep2', CHAR)).toEqual({});
    expect(readValues(app, CHAR)).toEqual({ str: stat(10) });
  });

  it('treats an absent bonus and a zero bonus as the same value', () => {
    setValue(app, 'ep1', CHAR, 'str', { kind: 'stat', base: 5 });
    setValue(app, 'ep2', CHAR, 'str', { kind: 'stat', base: 5, bonus: 0 });
    expect(readDelta(app, 'ep2', CHAR)).toEqual({});
  });
});

describe('clearValue', () => {
  it('puts the value back to what the document found — everywhere', () => {
    setValue(app, 'ep1', CHAR, 'str', stat(10));
    setValue(app, 'ep2', CHAR, 'str', stat(20));
    expect(foldTo(app, EPISODES, 'ep4', CHAR).values.str).toEqual(stat(20));

    clearValue(app, 'ep2', CHAR, 'str');
    expect(foldTo(app, EPISODES, 'ep2', CHAR).values.str).toEqual(stat(10));
    expect(foldTo(app, EPISODES, 'ep4', CHAR).values.str).toEqual(stat(10));
  });

  it('removes the attribute when the document introduced it', () => {
    setValue(app, 'ep2', CHAR, 'str', stat(20));
    clearValue(app, 'ep2', CHAR, 'str');
    expect(readValues(app, CHAR)).toEqual({});
  });

  it('does nothing for a document that never touched the attribute', () => {
    setValue(app, 'ep1', CHAR, 'str', stat(10));
    clearValue(app, 'ep3', CHAR, 'str');
    expect(readValues(app, CHAR)).toEqual({ str: stat(10) });
  });
});

describe('clearEpisode', () => {
  it('undoes every change one document made', () => {
    setValue(app, 'ep1', CHAR, 'str', stat(10));
    setValue(app, 'ep1', CHAR, 'agi', stat(5));
    setValue(app, 'ep2', CHAR, 'str', stat(20));
    setValue(app, 'ep2', CHAR, 'agi', stat(6));

    clearEpisode(app, 'ep2', CHAR);

    expect(readValues(app, CHAR)).toEqual({ str: stat(10), agi: stat(5) });
    expect(readDelta(app, 'ep2', CHAR)).toEqual({});
  });
});

describe('pruneDeltas', () => {
  it('drops entries for attributes the sheet no longer defines', () => {
    setValue(app, 'ep1', CHAR, 'str', stat(10));
    setValue(app, 'ep1', CHAR, 'gone', stat(3));
    setValue(app, 'ep2', CHAR, 'gone', stat(4));

    const schema: CharacterSchema = { groups: [], attrs: [{ id: 'str', name: '근력', kind: 'stat' }] };
    pruneDeltas(app, EPISODES, CHAR, schema);

    expect(readValues(app, CHAR)).toEqual({ str: stat(10) });
    expect(readDelta(app, 'ep2', CHAR)).toEqual({});
    expect(readPrev(app, 'ep2', CHAR)).toEqual({});
  });
});

/**
 * The upgrade path. Everything a writer typed under the old model lives in
 * `delta:<fileId>:<charId>` keys; the first read has to find them, or the fix
 * reads as data loss.
 */
describe('migration from per-episode deltas', () => {
  /** A host that can walk a project tree, which the migration needs. */
  function hostWithProject(files: ProjectFile[]): HostApi {
    const host = fakeHost() as unknown as { project: unknown };
    host.project = {
      available: true,
      children: (parentId: string | null) => (parentId === null ? files : [])
    };
    return host as unknown as HostApi;
  }

  const seedDelta = (host: HostApi, fileId: string, values: Record<string, AttributeValue>) => {
    host.storage.set(`delta:${fileId}:${CHAR}`, values, { scope: 'synced' });
  };

  it('recovers stats typed on the character’s own sheet', () => {
    const host = hostWithProject([episode('ep1'), { id: CHAR, type: 'sheet' } as ProjectFile]);
    seedDelta(host, CHAR, { lv: stat(10), hp: stat(1) });

    expect(readValues(host, CHAR)).toEqual({ lv: stat(10), hp: stat(1) });
    expect(foldTo(host, EPISODES, 'ep1', CHAR).values).toEqual({ lv: stat(10), hp: stat(1) });
  });

  it('merges chapter deltas, with the sheet’s own figures winning', () => {
    const host = hostWithProject([
      episode('ep1'),
      episode('ep2'),
      { id: CHAR, type: 'sheet' } as ProjectFile
    ]);
    seedDelta(host, 'ep1', { str: stat(10), agi: stat(1) });
    seedDelta(host, 'ep2', { str: stat(20) });
    seedDelta(host, CHAR, { str: stat(99) });

    expect(readValues(host, CHAR)).toEqual({ str: stat(99), agi: stat(1) });
  });

  it('runs once — a later edit is not overwritten by the old deltas', () => {
    const host = hostWithProject([episode('ep1')]);
    seedDelta(host, 'ep1', { str: stat(10) });

    expect(readValues(host, CHAR)).toEqual({ str: stat(10) });
    setValue(host, 'ep1', CHAR, 'str', stat(50));
    expect(readValues(host, CHAR)).toEqual({ str: stat(50) });
  });

  it('does not persist a half-done migration when the project is unreadable', () => {
    // `fakeHost` has `project.available: false` — no walk is possible, so the
    // migration must stay pending rather than bake in an empty sheet.
    expect(readValues(app, CHAR)).toEqual({});
    expect(app.storage.get(`values:${CHAR}`)).toBeUndefined();
  });
});
