import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FORMAT,
  formatArrow,
  formatBar,
  formatDelta,
  formatGauge,
  formatNumber,
  formatResource,
  formatStat,
  formatValue,
  gaugePercent
} from '../src/format';
import type { AttributeValue } from '../src/model';

const KO = DEFAULT_FORMAT;
const EN = { ...DEFAULT_FORMAT, thousands: true, regenLabel: 'regen', regenSuffix: '/min' };

describe('formatStat — transcribed from real serials', () => {
  it('renders base and equipment bonus (검신)', () => {
    expect(formatStat({ kind: 'stat', base: 415, bonus: 566 }, KO)).toBe('415(+566)');
    expect(formatStat({ kind: 'stat', base: 201, bonus: 420 }, KO)).toBe('201(+420)');
    expect(formatStat({ kind: 'stat', base: 62, bonus: 515 }, KO)).toBe('62(+515)');
  });

  it('renders a bare base with no bonus', () => {
    expect(formatStat({ kind: 'stat', base: 0 }, KO)).toBe('0');
    expect(formatStat({ kind: 'stat', base: 64 }, KO)).toBe('64');
  });

  /**
   * The one rule that looks like a typo in the source and isn't: across all ten
   * lines of 『회귀도 13번이면 지랄 맞다』's block, the bracket hugs a closing
   * paren and takes a space after a bare number. Never the other way round.
   */
  it('spaces the grade after a bare number but not after a paren (주공혁)', () => {
    expect(formatStat({ kind: 'stat', base: 14, grade: 'F' }, KO)).toBe('14 [F]');
    expect(formatStat({ kind: 'stat', base: 16, bonus: 2, grade: 'F' }, KO)).toBe('16(+2)[F]');
    expect(formatStat({ kind: 'stat', base: 21, grade: 'F' }, KO)).toBe('21 [F]');
    expect(formatStat({ kind: 'stat', base: 23, bonus: 2, grade: 'F' }, KO)).toBe('23(+2)[F]');
    expect(formatStat({ kind: 'stat', base: 18, bonus: 1, grade: 'F' }, KO)).toBe('18(+1)[F]');
  });

  it('carries a free-form note inside the bonus parens (주공혁)', () => {
    expect(
      formatStat({ kind: 'stat', base: 298, bonus: 260, note: '밸런스 한계치', grade: 'D' }, KO)
    ).toBe('298(+260 밸런스 한계치)[D]');
    expect(
      formatStat({ kind: 'stat', base: 300, bonus: 266, note: '밸런스 한계치', grade: 'D' }, KO)
    ).toBe('300(+266 밸런스 한계치)[D]');
  });

  it('carries a second modifier in the note (주공혁 정신)', () => {
    expect(formatStat({ kind: 'stat', base: 149, bonus: 187, note: '−50', grade: 'E' }, KO)).toBe(
      '149(+187 −50)[E]'
    );
  });

  it('uses a true minus sign for negative bonuses', () => {
    expect(formatStat({ kind: 'stat', base: 40, bonus: -12 }, KO)).toBe('40(−12)');
  });

  it('treats a zero bonus as absent — no empty parens', () => {
    expect(formatStat({ kind: 'stat', base: 10, bonus: 0, grade: 'F' }, KO)).toBe('10 [F]');
  });
});

describe('formatResource — the system message block', () => {
  it('renders pool with regeneration to two decimals', () => {
    const ko = { ...KO, regenDecimals: 2 };
    expect(formatResource({ kind: 'resource', cur: 70, max: 70, regen: 0.7 }, ko)).toBe(
      '70/70 재생 0.70/분'
    );
    expect(formatResource({ kind: 'resource', cur: 70, max: 70, regen: 0.8 }, ko)).toBe(
      '70/70 재생 0.80/분'
    );
    expect(formatResource({ kind: 'resource', cur: 40, max: 40, regen: 0.8 }, ko)).toBe(
      '40/40 재생 0.80/분'
    );
  });

  it('omits regeneration when there is none', () => {
    expect(formatResource({ kind: 'resource', cur: 100, max: 100 }, KO)).toBe('100/100');
  });

  it('localises the regen wording', () => {
    expect(formatResource({ kind: 'resource', cur: 50, max: 80, regen: 2 }, EN)).toBe(
      '50/80 regen 2/min'
    );
  });
});

describe('formatGauge — rank progress (He Who Fights With Monsters)', () => {
  it('renders percent with the fraction in support', () => {
    expect(formatGauge({ kind: 'gauge', cur: 0, max: 4, unit: '에센스' }, KO)).toBe('0% (0/4 에센스)');
    expect(formatGauge({ kind: 'gauge', cur: 2, max: 4, unit: '에센스' }, KO)).toBe('50% (2/4 에센스)');
  });

  it('floors rather than rounds — 3.9 of 4 is not complete', () => {
    expect(gaugePercent({ kind: 'gauge', cur: 3.9, max: 4 })).toBe(97);
    expect(gaugePercent({ kind: 'gauge', cur: 3, max: 4 })).toBe(75);
  });

  it('does not divide by zero', () => {
    expect(gaugePercent({ kind: 'gauge', cur: 5, max: 0 })).toBe(0);
  });

  it('groups thousands for LitRPG XP', () => {
    expect(formatGauge({ kind: 'gauge', cur: 1240, max: 2000, unit: 'XP' }, EN)).toBe(
      '62% (1,240/2,000 XP)'
    );
  });
});

describe('formatNumber', () => {
  it('leaves Korean and Japanese numbers ungrouped', () => {
    expect(formatNumber(1240, KO)).toBe('1240');
    expect(formatNumber(4545, KO)).toBe('4545');
  });

  it('groups thousands for LitRPG', () => {
    expect(formatNumber(1240, EN)).toBe('1,240');
    expect(formatNumber(2000, EN)).toBe('2,000');
    expect(formatNumber(999, EN)).toBe('999');
    expect(formatNumber(1234567, EN)).toBe('1,234,567');
  });

  it('groups only the whole part', () => {
    expect(formatNumber(1234.5, EN)).toBe('1,234.5');
  });
});

describe('formatValue — list punctuation follows the convention', () => {
  const items: AttributeValue = { kind: 'list', items: ['인터페이스', '퀘스트 시스템', '인벤토리'] };

  it('joins with comma-space by default', () => {
    expect(formatValue(items, KO)).toBe('인터페이스, 퀘스트 시스템, 인벤토리');
  });

  it('joins with the ideographic comma in Japanese', () => {
    expect(formatValue(items, { ...KO, listJoin: '、' })).toBe('인터페이스、퀘스트 시스템、인벤토리');
  });

  it('drops blank items', () => {
    expect(formatValue({ kind: 'list', items: ['A', '  ', 'B'] }, KO)).toBe('A, B');
  });
});

describe('formatArrow — the growth line', () => {
  it('joins previous and current when they differ (주공혁)', () => {
    expect(
      formatArrow(
        { kind: 'stat', base: 14, grade: 'F' },
        { kind: 'stat', base: 16, bonus: 2, grade: 'F' },
        KO
      )
    ).toBe('14 [F] → 16(+2)[F]');

    expect(
      formatArrow(
        { kind: 'stat', base: 38, grade: 'F' },
        { kind: 'stat', base: 298, bonus: 260, note: '밸런스 한계치', grade: 'D' },
        KO
      )
    ).toBe('38 [F] → 298(+260 밸런스 한계치)[D]');
  });

  it('prints the value alone when nothing changed', () => {
    const same: AttributeValue = { kind: 'stat', base: 10 };
    expect(formatArrow(same, same, KO)).toBe('10');
  });

  it('prints the value alone on the first episode', () => {
    expect(formatArrow(undefined, { kind: 'number', n: 1 }, KO)).toBe('1');
  });
});

describe('formatDelta', () => {
  it('reports the signed change in the base, not the bonus', () => {
    expect(
      formatDelta({ kind: 'stat', base: 14 }, { kind: 'stat', base: 16, bonus: 999 }, KO)
    ).toBe('+2');
  });

  it('is empty when nothing moved — so {{#delta}} is a clean falsy test', () => {
    expect(formatDelta({ kind: 'stat', base: 5 }, { kind: 'stat', base: 5 }, KO)).toBe('');
    expect(formatDelta(undefined, { kind: 'stat', base: 5 }, KO)).toBe('');
  });

  it('is empty for kinds that have no magnitude', () => {
    expect(formatDelta({ kind: 'text', text: 'a' }, { kind: 'text', text: 'b' }, KO)).toBe('');
  });

  it('uses a true minus sign going down', () => {
    expect(formatDelta({ kind: 'number', n: 10 }, { kind: 'number', n: 4 }, KO)).toBe('−6');
  });
});

describe('formatBar', () => {
  it('fills proportionally', () => {
    expect(formatBar(0, KO)).toBe('░░░░░░░░░░');
    expect(formatBar(50, KO)).toBe('█████░░░░░');
    expect(formatBar(100, KO)).toBe('██████████');
  });

  it('clamps out-of-range input', () => {
    expect(formatBar(-20, KO)).toBe('░░░░░░░░░░');
    expect(formatBar(140, KO)).toBe('██████████');
  });
});
