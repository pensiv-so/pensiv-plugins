import { describe, it, expect } from 'vitest';
import {
  applyKey,
  formatDisplay,
  initialState,
  keyFromEvent,
  type CalcKey,
  type CalcState
} from '../src/engine';

/**
 * The engine is the only part of this plugin that can be *wrong* rather than
 * merely ugly: the surfaces just draw whatever state it produces. So the tests
 * live here, on the pure machine, and press keys the way a user does.
 */

/** Type a sequence the way a keypad would: `'12+3='`. */
const press = (sequence: string, from: CalcState = initialState()): CalcState =>
  [...sequence].reduce((state, char) => {
    const key = keyFromEvent({ key: char });
    if (!key) throw new Error(`no key for "${char}"`);
    return applyKey(state, key);
  }, from);

const key = (k: CalcKey) => k;

describe('calculator engine', () => {
  it('types digits and a single decimal point', () => {
    expect(press('12.5').entry).toBe('12.5');
    // A second point is a no-op, not a second dot in the string.
    expect(press('12.5.5').entry).toBe('12.55');
  });

  it('adds, subtracts, multiplies and divides', () => {
    expect(press('12+3=').entry).toBe('15');
    expect(press('12-3=').entry).toBe('9');
    expect(press('12*3=').entry).toBe('36');
    expect(press('12/3=').entry).toBe('4');
  });

  it('chains operators by closing the pending one first', () => {
    // `2 + 3 ×` shows 5 before 4 is typed — the running total, as on a pocket
    // calculator, not "3 × 4 then add".
    const chained = press('2+3*');
    expect(chained.entry).toBe('5');
    expect(press('4=', chained).entry).toBe('20');
  });

  it('swaps the operator when two are pressed in a row', () => {
    expect(press('5+*3=').entry).toBe('15');
  });

  it('repeats the last operation on a second equals', () => {
    const once = press('2+3=');
    expect(once.entry).toBe('5');
    const twice = applyKey(once, key({ type: 'equals' }));
    expect(twice.entry).toBe('8');
    expect(applyKey(twice, key({ type: 'equals' })).entry).toBe('11');
  });

  it('rounds away binary floating-point noise', () => {
    // 0.30000000000000004 is correct and unusable on a display.
    expect(press('0.1+0.2=').entry).toBe('0.3');
  });

  it('treats percent after + / − as a percentage of the left operand', () => {
    const state = applyKey(press('200+10'), key({ type: 'percent' }));
    expect(state.entry).toBe('20');
    expect(applyKey(state, key({ type: 'equals' })).entry).toBe('220');
  });

  it('treats a standalone percent as divide-by-a-hundred', () => {
    expect(applyKey(press('50'), key({ type: 'percent' })).entry).toBe('0.5');
  });

  it('errors on divide by zero and only clear gets out', () => {
    const bad = press('5/0=');
    expect(bad.error).toBe(true);
    expect(bad.entry).toBe('Error');
    // Digits are ignored while errored — no arithmetic on top of a bad state.
    expect(press('7', bad).entry).toBe('Error');
    expect(applyKey(bad, key({ type: 'clear' })).entry).toBe('0');
    expect(applyKey(bad, key({ type: 'clear' })).error).toBe(false);
  });

  it('backspaces typed digits but never a settled result', () => {
    expect(applyKey(press('123'), key({ type: 'backspace' })).entry).toBe('12');
    // After `=` the entry is a result, not something being typed.
    const result = press('12+3=');
    expect(applyKey(result, key({ type: 'backspace' })).entry).toBe('15');
    // Backspacing the last digit leaves a zero, not an empty display.
    expect(applyKey(press('7'), key({ type: 'backspace' })).entry).toBe('0');
  });

  it('negates the entry, but leaves zero alone', () => {
    expect(applyKey(press('42'), key({ type: 'negate' })).entry).toBe('-42');
    expect(applyKey(press('0'), key({ type: 'negate' })).entry).toBe('0');
  });

  it('keeps memory across a clear', () => {
    const stored = applyKey(press('42'), key({ type: 'memory', value: 'store' }));
    const cleared = applyKey(stored, key({ type: 'clear' }));
    expect(cleared.entry).toBe('0');
    expect(cleared.memory).toBe(42);
    expect(applyKey(cleared, key({ type: 'memory', value: 'recall' })).entry).toBe('42');
  });

  it('accumulates into memory with M+ and M−', () => {
    let state = applyKey(press('10'), key({ type: 'memory', value: 'add' }));
    state = applyKey(press('4', state), key({ type: 'memory', value: 'add' }));
    state = applyKey(press('6', state), key({ type: 'memory', value: 'sub' }));
    expect(state.memory).toBe(8);
    expect(applyKey(state, key({ type: 'memory', value: 'clear' })).memorySet).toBe(false);
  });

  it('ignores memory recall when nothing was ever stored', () => {
    const state = press('7');
    expect(applyKey(state, key({ type: 'memory', value: 'recall' })).entry).toBe('7');
  });

  it('records the expression trail equals produces', () => {
    expect(press('12*4=').trail).toBe('12 × 4 =');
  });

  it('ignores keystrokes carrying a modifier', () => {
    expect(keyFromEvent({ key: 'c', metaKey: true })).toBeNull();
    expect(keyFromEvent({ key: '5', ctrlKey: true })).toBeNull();
    expect(keyFromEvent({ key: 'q' })).toBeNull();
  });

  describe('formatDisplay', () => {
    const base = { group: true, decimals: 6, locale: 'en' };

    it('groups thousands and keeps typed zeros', () => {
      expect(formatDisplay('1234567', base)).toBe('1,234,567');
      expect(formatDisplay('1.50', base)).toBe('1.50');
    });

    it('leaves mid-typing states alone', () => {
      // Formatting `12.` would eat the point the user just pressed.
      expect(formatDisplay('12.', base)).toBe('12.');
      expect(formatDisplay('-', base)).toBe('-');
    });

    it('caps shown decimals without touching the stored value', () => {
      expect(formatDisplay('0.123456789', { ...base, decimals: 3 })).toBe('0.123');
    });

    it('drops to exponential rather than printing twenty zeros', () => {
      expect(formatDisplay('1e20', base)).toContain('e ');
      expect(formatDisplay('Error', base)).toBe('Error');
    });

    it('can be asked for an ungrouped number, for pasting into a formula', () => {
      expect(formatDisplay('1234567', { ...base, group: false })).toBe('1234567');
    });
  });
});
