import { describe, it, expect } from 'vitest';
import { nextId, readItems } from '../src/items';

/**
 * The node's state is JSON inside the canvas blob: it can arrive from an older
 * plugin version, from another device, or hand-edited. `readItems` is the only
 * gate in front of the renderer, so its tolerance is what keeps a malformed
 * payload from taking the whole canvas down — and `nextId` is what keeps two
 * clients from minting the same row id.
 */
describe('readItems', () => {
  it('reads well-formed rows and defaults `done`', () => {
    const items = readItems({
      items: [
        { id: 'i1', text: 'first', done: true },
        { id: 'i2', text: 'second' }
      ]
    });
    expect(items).toEqual([
      { id: 'i1', text: 'first', done: true },
      { id: 'i2', text: 'second', done: false }
    ]);
  });

  it('returns an empty list for anything that is not a state object', () => {
    expect(readItems(null)).toEqual([]);
    expect(readItems('nope')).toEqual([]);
    expect(readItems(42)).toEqual([]);
    expect(readItems([{ id: 'i1', text: 'x' }])).toEqual([]);
    expect(readItems({})).toEqual([]);
    expect(readItems({ items: 'not-an-array' })).toEqual([]);
  });

  it('drops malformed rows instead of throwing', () => {
    const items = readItems({
      items: [
        { id: 'i1', text: 'keep' },
        null,
        'row',
        ['nested'],
        { id: 7, text: 'bad id' },
        { id: 'i3' },
        { id: 'i4', text: 'also keep', done: 'yes' }
      ]
    });
    // `done: 'yes'` is not `true`, so it reads as unchecked rather than truthy.
    expect(items).toEqual([
      { id: 'i1', text: 'keep', done: false },
      { id: 'i4', text: 'also keep', done: false }
    ]);
  });
});

describe('nextId', () => {
  it('starts at i1 for an empty list', () => {
    expect(nextId([])).toBe('i1');
  });

  it('continues past the highest suffix, not the row count', () => {
    const items = [
      { id: 'i1', text: 'a', done: false },
      { id: 'i7', text: 'b', done: false }
    ];
    expect(nextId(items)).toBe('i8');
  });

  it('does not collide after a middle row is deleted', () => {
    const items = [
      { id: 'i1', text: 'a', done: false },
      { id: 'i2', text: 'b', done: false },
      { id: 'i3', text: 'c', done: false }
    ];
    const remaining = items.filter((item) => item.id !== 'i2');
    expect(nextId(remaining)).toBe('i4');
    expect(remaining.map((item) => item.id)).not.toContain(nextId(remaining));
  });

  it('ignores ids it did not mint', () => {
    const items = [
      { id: 'legacy-row', text: 'a', done: false },
      { id: 'i2-1', text: 'b', done: false }
    ];
    // `i2-1` parses as 2; the non-numeric id contributes nothing.
    expect(nextId(items)).toBe('i3');
  });

  it('is deterministic — same state, same id on every client', () => {
    const items = [{ id: 'i4', text: 'a', done: false }];
    expect(nextId(items)).toBe(nextId(items));
  });
});
