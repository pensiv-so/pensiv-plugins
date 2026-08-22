import { describe, it, expect } from 'vitest';
import {
  addDays,
  addMonths,
  ageOn,
  birthdayIn,
  daysBetween,
  diffYMD,
  formatDate,
  fromDayNumber,
  isLeapYear,
  parseISO,
  shift,
  toDayNumber,
  toISO,
  weekdayOf,
  weeksAndDays
} from '../src/engine';

/**
 * Date arithmetic is where this plugin can be *wrong* rather than merely ugly, so
 * the tests concentrate on the cases that break naive implementations: leap days,
 * month-end clamping, the borrow in a Y/M/D difference, and dates before 1970.
 */
const d = (iso: string) => {
  const parsed = parseISO(iso);
  if (!parsed) throw new Error(`bad date: ${iso}`);
  return parsed;
};

describe('civil date conversion', () => {
  it('round-trips through the day number', () => {
    for (const iso of ['1970-01-01', '2026-08-22', '1900-03-01', '2000-02-29', '1867-11-05']) {
      expect(toISO(fromDayNumber(toDayNumber(d(iso))))).toBe(iso);
    }
  });

  it('anchors the epoch and counts backwards for earlier dates', () => {
    expect(toDayNumber(d('1970-01-01'))).toBe(0);
    expect(toDayNumber(d('1969-12-31'))).toBe(-1);
  });

  it('knows the Gregorian leap rule, including the century exceptions', () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
  });

  it('gives the weekday, before and after the epoch', () => {
    expect(weekdayOf(d('1970-01-01'))).toBe(4); // a Thursday
    expect(weekdayOf(d('2026-08-22'))).toBe(6); // a Saturday
    expect(weekdayOf(d('1969-12-25'))).toBe(4); // a Thursday
  });

  it('rejects dates that do not exist', () => {
    expect(parseISO('2026-02-29')).toBeNull();
    expect(parseISO('2026-13-01')).toBeNull();
    expect(parseISO('2026-8-2')).toBeNull();
    expect(parseISO('2024-02-29')).not.toBeNull();
  });
});

describe('addition', () => {
  it('adds days across a month and a year boundary', () => {
    expect(toISO(addDays(d('2026-08-31'), 1))).toBe('2026-09-01');
    expect(toISO(addDays(d('2026-12-31'), 1))).toBe('2027-01-01');
    expect(toISO(addDays(d('2026-03-01'), -1))).toBe('2026-02-28');
  });

  it('clamps to the end of the month when adding months', () => {
    // 31 Jan + 1 month is the end of February, not 3 March.
    expect(toISO(addMonths(d('2026-01-31'), 1))).toBe('2026-02-28');
    expect(toISO(addMonths(d('2024-01-31'), 1))).toBe('2024-02-29');
    expect(toISO(addMonths(d('2026-08-31'), -1))).toBe('2026-07-31');
    expect(toISO(addMonths(d('2026-08-15'), 12))).toBe('2027-08-15');
  });

  it('shifts by whatever unit the panel asks for', () => {
    expect(toISO(shift(d('2026-08-22'), 3, 'weeks'))).toBe('2026-09-12');
    expect(toISO(shift(d('2026-08-22'), -2, 'years'))).toBe('2024-08-22');
    expect(toISO(shift(d('2024-02-29'), 1, 'years'))).toBe('2025-02-28');
  });
});

describe('differences', () => {
  it('counts whole days in both directions', () => {
    expect(daysBetween(d('2026-08-01'), d('2026-08-03'))).toBe(2);
    expect(daysBetween(d('2026-08-03'), d('2026-08-01'))).toBe(-2);
  });

  it('measures whole months the same way adding them works', () => {
    // 31 Jan + 1 month clamps to 28 Feb, so 31 Jan → 1 Mar is "1 month, 1 day",
    // and 31 Jan → 28 Feb is exactly one month. The two modes agree by
    // construction: `from + diff === to`.
    expect(diffYMD(d('2026-01-31'), d('2026-03-01'))).toMatchObject({
      years: 0,
      months: 1,
      days: 1
    });
    expect(diffYMD(d('2026-01-31'), d('2026-02-28'))).toMatchObject({
      years: 0,
      months: 1,
      days: 0
    });
    // Clamping collapses the tail of a long month: 28, 29, 30 and 31 January all
    // land on 28 February a month later, so each reads as exactly one month.
    expect(diffYMD(d('2026-01-30'), d('2026-02-28'))).toMatchObject({
      years: 0,
      months: 1,
      days: 0
    });
    expect(diffYMD(d('2026-01-27'), d('2026-02-28'))).toMatchObject({
      years: 0,
      months: 1,
      days: 1
    });
  });

  it('round-trips: adding the difference back lands on the end date', () => {
    const pairs: Array<[string, string]> = [
      ['2026-01-31', '2026-03-01'],
      ['1998-05-11', '2026-08-22'],
      ['2024-02-29', '2026-02-28'],
      ['1899-12-31', '1901-01-01']
    ];
    for (const [from, to] of pairs) {
      const parts = diffYMD(d(from), d(to));
      const rebuilt = addDays(addMonths(d(from), parts.years * 12 + parts.months), parts.days);
      expect(toISO(rebuilt)).toBe(to);
    }
  });

  it('reports a reversed span as positive, with a flag', () => {
    const reversed = diffYMD(d('2026-08-22'), d('2020-01-01'));
    expect(reversed.negative).toBe(true);
    expect(reversed.years).toBe(6);
    expect(reversed.totalDays).toBeGreaterThan(0);
  });

  it('splits a total into weeks and days', () => {
    expect(weeksAndDays(17)).toEqual({ weeks: 2, days: 3 });
    expect(weeksAndDays(14)).toEqual({ weeks: 2, days: 0 });
  });
});

describe('age', () => {
  it('reports completed years, not the year difference', () => {
    // The day before the birthday is still the previous age.
    expect(ageOn(d('1998-05-11'), d('2026-05-10')).years).toBe(27);
    expect(ageOn(d('1998-05-11'), d('2026-05-11')).years).toBe(28);
  });

  it('gives the Korean counting age and the year age', () => {
    const age = ageOn(d('1998-05-11'), d('2026-01-01'));
    expect(age.years).toBe(27); // 만 나이
    expect(age.koreanAge).toBe(29); // 세는 나이 — +1 at birth, +1 each New Year
    expect(age.yearAge).toBe(28); // 연 나이 — the year difference alone
  });

  it('counts down to the next birthday, and lands on it', () => {
    expect(ageOn(d('1998-05-11'), d('2026-05-11')).daysToBirthday).toBe(0);
    const before = ageOn(d('1998-05-11'), d('2026-05-01'));
    expect(before.daysToBirthday).toBe(10);
    expect(toISO(before.nextBirthday)).toBe('2026-05-11');
    // On the day after, the countdown rolls to next year rather than going
    // negative or sticking at zero.
    const after = ageOn(d('1998-05-11'), d('2026-05-12'));
    expect(toISO(after.nextBirthday)).toBe('2027-05-11');
  });

  it('moves a 29 February birthday to 1 March in common years', () => {
    expect(toISO(birthdayIn(d('2004-02-29'), 2026))).toBe('2026-03-01');
    expect(toISO(birthdayIn(d('2004-02-29'), 2028))).toBe('2028-02-29');
    // Which keeps the countdown from skipping three years in four.
    expect(ageOn(d('2004-02-29'), d('2026-02-28')).daysToBirthday).toBe(1);
  });

  it('flags a reference date before the birth date instead of going negative', () => {
    const unborn = ageOn(d('2026-08-22'), d('2020-01-01'));
    expect(unborn.unborn).toBe(true);
    expect(unborn.years).toBe(0);
    expect(unborn.koreanAge).toBe(0);
  });
});

describe('formatting', () => {
  it('writes ISO, dotted and localized forms', () => {
    const date = d('2026-08-22');
    expect(formatDate(date, 'iso', 'en')).toBe('2026-08-22');
    expect(formatDate(date, 'dotted', 'ko')).toBe('2026. 8. 22.');
    // Built on a UTC timestamp, so the civil date can't slip a day west of
    // Greenwich — the year and day must survive whatever zone the test runs in.
    const localized = formatDate(date, 'locale', 'en');
    expect(localized).toContain('2026');
    expect(localized).toContain('22');
  });
});
