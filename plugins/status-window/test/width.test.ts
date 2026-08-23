import { describe, expect, it } from 'vitest';
import { maxWidth, padEnd, padStart, stringWidth } from '../src/width';

describe('stringWidth', () => {
  it('counts Latin as one column', () => {
    expect(stringWidth('STR')).toBe(3);
    expect(stringWidth('Level')).toBe(5);
  });

  it('counts Hangul as two', () => {
    expect(stringWidth('근력')).toBe(4);
    expect(stringWidth('생명력')).toBe(6);
    expect(stringWidth('마나 회복력')).toBe(11); // 5 syllables ×2 + one space
  });

  it('counts kana and kanji as two', () => {
    expect(stringWidth('腕力')).toBe(4);
    expect(stringWidth('スキル')).toBe(6);
    expect(stringWidth('名前')).toBe(4);
  });

  it('counts fullwidth punctuation and the ideographic space as two', () => {
    expect(stringWidth('：')).toBe(2);
    expect(stringWidth('　')).toBe(2);
    expect(stringWidth('Ｌv')).toBe(3); // fullwidth L + halfwidth v
    expect(stringWidth('、')).toBe(2);
    expect(stringWidth('【】')).toBe(4);
  });

  it('counts mixed strings correctly', () => {
    expect(stringWidth('근력: 10')).toBe(8); // 4 + 1 + 1 + 2
    expect(stringWidth('HP')).toBe(2);
  });

  it('ignores combining marks and zero-width characters', () => {
    expect(stringWidth('é')).toBe(1);
    expect(stringWidth('a​b')).toBe(2);
  });

  it('counts an astral character once', () => {
    expect(stringWidth('\u{20000}')).toBe(2);
  });
});

describe('padEnd', () => {
  /**
   * The bug this exists to prevent: `String.prototype.padEnd` uses UTF-16
   * length, so `근력` reads as 2 and gets four spaces where it needs two — the
   * colons end up ragged, which is exactly what makes generated output look
   * generated.
   */
  it('pads by display columns, not by string length', () => {
    expect(padEnd('근력', 6)).toBe('근력  ');
    expect(padEnd('생명력', 6)).toBe('생명력');
    expect('근력'.padEnd(6)).toBe('근력    '); // what we are NOT doing
  });

  it('lines a Korean stat column up', () => {
    const names = ['근력', '생명력', '마나 회복력'];
    const width = maxWidth(names);
    const padded = names.map((name) => `${padEnd(name, width)} : x`);
    expect(padded).toEqual([
      '근력        : x',
      '생명력      : x',
      '마나 회복력 : x'
    ]);
  });

  it('pads with the ideographic space for Japanese sheets', () => {
    // Two columns short → one fullwidth space, not two ASCII ones.
    expect(padEnd('名前', 6, '　')).toBe('名前　');
  });

  it('returns overlong input untouched rather than truncating', () => {
    expect(padEnd('마나 회복력', 4)).toBe('마나 회복력');
  });
});

describe('padStart', () => {
  it('right-aligns numbers the way 검신 does', () => {
    const values = ['415(+566)', '62(+515)'];
    const width = maxWidth(values);
    expect(values.map((v) => padStart(v, width))).toEqual(['415(+566)', ' 62(+515)']);
  });
});

describe('maxWidth', () => {
  it('is zero for an empty set', () => {
    expect(maxWidth([])).toBe(0);
  });

  it('measures in columns', () => {
    expect(maxWidth(['STR', '근력', 'Experience'])).toBe(10);
  });
});
