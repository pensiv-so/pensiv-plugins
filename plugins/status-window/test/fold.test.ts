/**
 * The delta fold — the thing spreadsheets can't do.
 *
 * Two properties matter and both are tested here: state at an arbitrary episode
 * is a pure function of the deltas before it, and editing an early episode
 * changes every later one without touching them.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { HostApi, ProjectFile } from '@pensiv/plugin-sdk';
import {
  clearValue,
  foldTo,
  hasEntry,
  pruneDeltas,
  readDelta,
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

/** Write ignoring carry-forward — the raw delta, for setting up a scenario. */
function put(episodeId: string, attrId: string, value: AttributeValue): void {
  setValue(app, episodeId, CHAR, attrId, value, undefined);
}

describe('foldTo', () => {
  it('is empty before anything is written', () => {
    const { values, previous } = foldTo(app, EPISODES, 'ep1', CHAR);
    expect(values).toEqual({});
    expect(previous).toEqual({});
  });

  it('carries a value forward to later episodes untouched', () => {
    put('ep1', 'str', stat(10));

    expect(foldTo(app, EPISODES, 'ep1', CHAR).values).toEqual({ str: stat(10) });
    expect(foldTo(app, EPISODES, 'ep3', CHAR).values).toEqual({ str: stat(10) });
  });

  it('applies the latest change at or before the episode', () => {
    put('ep1', 'str', stat(10));
    put('ep3', 'str', stat(30));

    expect(foldTo(app, EPISODES, 'ep2', CHAR).values).toEqual({ str: stat(10) });
    expect(foldTo(app, EPISODES, 'ep3', CHAR).values).toEqual({ str: stat(30) });
    expect(foldTo(app, EPISODES, 'ep4', CHAR).values).toEqual({ str: stat(30) });
  });

  it('exposes the previous episode’s state as the diff baseline', () => {
    put('ep1', 'str', stat(10));
    put('ep3', 'str', stat(30));

    const at3 = foldTo(app, EPISODES, 'ep3', CHAR);
    expect(at3.previous).toEqual({ str: stat(10) });
    expect(at3.values).toEqual({ str: stat(30) });

    // Nothing changed in ep4, so its baseline equals its state — the growth
    // arrow collapses to a plain value, which is what the template relies on.
    const at4 = foldTo(app, EPISODES, 'ep4', CHAR);
    expect(at4.previous).toEqual(at4.values);
  });

  it('merges independent attributes written in different episodes', () => {
    put('ep1', 'str', stat(10));
    put('ep2', 'agi', stat(5));
    put('ep3', 'str', stat(12));

    expect(foldTo(app, EPISODES, 'ep3', CHAR).values).toEqual({ str: stat(12), agi: stat(5) });
  });

  /**
   * The headline property: correcting chapter 1 rewrites every later chapter's
   * reading, because no later chapter ever stored a copy.
   */
  it('recalculates downstream when an earlier episode is edited', () => {
    put('ep1', 'str', stat(10));
    put('ep4', 'agi', stat(1));
    expect(foldTo(app, EPISODES, 'ep4', CHAR).values.str).toEqual(stat(10));

    put('ep1', 'str', stat(99));
    expect(foldTo(app, EPISODES, 'ep2', CHAR).values.str).toEqual(stat(99));
    expect(foldTo(app, EPISODES, 'ep4', CHAR).values.str).toEqual(stat(99));
  });

  it('reports the episode index, and -1 for a file outside the scope', () => {
    expect(foldTo(app, EPISODES, 'ep3', CHAR).index).toBe(2);
    expect(foldTo(app, EPISODES, 'stray', CHAR).index).toBe(-1);
  });

  it('folds the whole manuscript for a file outside the scope', () => {
    put('ep1', 'str', stat(10));
    put('ep4', 'str', stat(40));
    // A scratch document should read the latest state, not an empty sheet.
    expect(foldTo(app, EPISODES, 'stray', CHAR).values).toEqual({ str: stat(40) });
  });

  it('keeps characters apart', () => {
    put('ep1', 'str', stat(10));
    expect(foldTo(app, EPISODES, 'ep2', 'other').values).toEqual({});
  });
});

describe('setValue', () => {
  it('stores nothing when the value matches what carries forward', () => {
    setValue(app, 'ep2', CHAR, 'str', stat(10), stat(10));
    expect(readDelta(app, 'ep2', CHAR)).toEqual({});
    expect(hasEntry(app, 'ep2', CHAR)).toBe(false);
  });

  it('stores the change when it differs', () => {
    setValue(app, 'ep2', CHAR, 'str', stat(11), stat(10));
    expect(readDelta(app, 'ep2', CHAR)).toEqual({ str: stat(11) });
  });

  /**
   * Typing a stat up and back down again must leave no trace — otherwise the
   * store grows with keystrokes rather than with edits, and the row shows up as
   * "changed" while reading identically to last chapter.
   */
  it('removes an entry when the value is set back to the inherited one', () => {
    setValue(app, 'ep2', CHAR, 'str', stat(11), stat(10));
    setValue(app, 'ep2', CHAR, 'str', stat(10), stat(10));
    expect(readDelta(app, 'ep2', CHAR)).toEqual({});
  });

  it('treats an absent bonus and a zero bonus as the same value', () => {
    setValue(app, 'ep2', CHAR, 'str', { kind: 'stat', base: 5, bonus: 0 }, { kind: 'stat', base: 5 });
    expect(readDelta(app, 'ep2', CHAR)).toEqual({});
  });

  it('writes a first value against no baseline', () => {
    setValue(app, 'ep1', CHAR, 'str', stat(1), undefined);
    expect(readDelta(app, 'ep1', CHAR)).toEqual({ str: stat(1) });
  });
});

describe('clearValue', () => {
  it('makes the episode inherit again', () => {
    put('ep1', 'str', stat(10));
    put('ep2', 'str', stat(20));
    expect(foldTo(app, EPISODES, 'ep2', CHAR).values.str).toEqual(stat(20));

    clearValue(app, 'ep2', CHAR, 'str');
    expect(foldTo(app, EPISODES, 'ep2', CHAR).values.str).toEqual(stat(10));
  });
});

describe('pruneDeltas', () => {
  it('drops entries for attributes the sheet no longer defines', () => {
    put('ep1', 'str', stat(10));
    put('ep1', 'gone', stat(3));
    put('ep2', 'gone', stat(4));

    const schema: CharacterSchema = { groups: [], attrs: [{ id: 'str', name: '근력', kind: 'stat' }] };
    pruneDeltas(app, EPISODES, CHAR, schema);

    expect(readDelta(app, 'ep1', CHAR)).toEqual({ str: stat(10) });
    expect(readDelta(app, 'ep2', CHAR)).toEqual({});
  });
});
