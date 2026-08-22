// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { dateStore } from '../src/store';
import { toISO, type CivilDate } from '../src/engine';

/**
 * The store is what keeps the header dialog, the floating widget and the phone
 * sheet showing the same dates, so the behaviour worth pinning down is what
 * happens when a *second* surface mounts: blanks fill, but nothing the user
 * chose gets overwritten.
 */
const TODAY: CivilDate = { year: 2026, month: 8, day: 22 };

describe('dateStore', () => {
  beforeEach(() => {
    localStorage.clear();
    dateStore.reset(TODAY);
    // `reset` keeps `seeded`; clear it so each test starts from a fresh install.
    dateStore.patch({ seeded: false, mode: 'age' });
  });

  it('fills blank dates with today on the first mount', () => {
    dateStore.patch({ reference: '', from: '', to: '', shiftBase: '' });
    dateStore.hydrate(TODAY);
    expect(dateStore.state.reference).toBe(toISO(TODAY));
    expect(dateStore.state.from).toBe(toISO(TODAY));
    expect(dateStore.state.shiftBase).toBe(toISO(TODAY));
    // The birth date is deliberately left empty — there is no sensible default,
    // and pre-filling it would make the panel claim an age nobody entered.
    expect(dateStore.state.birth).toBe('');
  });

  it('never overwrites a date the user typed', () => {
    dateStore.patch({ from: '2001-01-01' });
    dateStore.hydrate(TODAY);
    expect(dateStore.state.from).toBe('2001-01-01');
  });

  it('applies the default-mode setting once, then leaves the mode alone', () => {
    dateStore.hydrate(TODAY, 'shift');
    expect(dateStore.state.mode).toBe('shift');

    // The user switches mode; a second surface mounting must not undo that.
    dateStore.patch({ mode: 'between' });
    dateStore.hydrate(TODAY, 'shift');
    expect(dateStore.state.mode).toBe('between');
  });

  it('keeps the mode across a reset, and clears the dates', () => {
    dateStore.patch({ mode: 'between', birth: '1998-05-11', from: '2001-01-01' });
    dateStore.reset(TODAY);
    expect(dateStore.state.mode).toBe('between');
    expect(dateStore.state.birth).toBe('');
    expect(dateStore.state.from).toBe(toISO(TODAY));
  });

  it('notifies subscribers so every surface redraws together', () => {
    let calls = 0;
    const unsubscribe = dateStore.subscribe(() => {
      calls += 1;
    });
    dateStore.patch({ birth: '1998-05-11' });
    expect(calls).toBe(1);
    unsubscribe();
    dateStore.patch({ birth: '1999-01-01' });
    expect(calls).toBe(1);
  });
});
