/**
 * Civil-date arithmetic — pure, no `Date` objects in the model, no host API.
 *
 * Everything here works on a plain `{ year, month, day }` triple and integer day
 * numbers. That is deliberate: `new Date('2026-02-29')` silently rolls to March,
 * daylight-saving shifts make "add one day" occasionally add 23 hours, and a
 * birthday is a calendar fact with no time zone at all. A character born on
 * 29 February must stay born on 29 February in every renderer on Earth.
 */

/** A calendar date with no time and no zone. Months are 1-12, days 1-31. */
export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

/** Days in `month` of `year`, Gregorian. */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

export const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/**
 * Days since 1970-01-01 for a civil date (Howard Hinnant's `days_from_civil`).
 * Exact for any Gregorian year, and the basis for every difference below.
 */
export function toDayNumber({ year, month, day }: CivilDate): number {
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400; // [0, 399]
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1; // [0, 365]
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy; // [0, 146096]
  return era * 146097 + doe - 719468;
}

/** Inverse of {@link toDayNumber} (`civil_from_days`). */
export function fromDayNumber(days: number): CivilDate {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  return { year: y + (month <= 2 ? 1 : 0), month, day };
}

/** Whole days from `a` to `b`; negative when `b` is earlier. */
export const daysBetween = (a: CivilDate, b: CivilDate): number => toDayNumber(b) - toDayNumber(a);

export const addDays = (date: CivilDate, days: number): CivilDate =>
  fromDayNumber(toDayNumber(date) + days);

/**
 * Add months, clamping to the end of the target month — 31 Jan + 1 month is
 * 28 (or 29) Feb, not 3 March. Clamping is what every calendar app does and what
 * a reader expects of "a month later".
 */
export function addMonths(date: CivilDate, months: number): CivilDate {
  const total = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12 + 1;
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

export const addYears = (date: CivilDate, years: number): CivilDate => addMonths(date, years * 12);

/** 0 = Sunday … 6 = Saturday. */
export const weekdayOf = (date: CivilDate): number => {
  const days = toDayNumber(date);
  // 1970-01-01 was a Thursday (4); the modulo is written to stay non-negative
  // for dates before the epoch.
  return ((days % 7) + 11) % 7;
};

/** A calendar difference split the way people say it: "3 years, 2 months, 5 days". */
export interface YearsMonthsDays {
  years: number;
  months: number;
  days: number;
  /** Total whole days between the two dates, always ≥ 0. */
  totalDays: number;
  /** True when `to` is earlier than `from` — the caller decides how to phrase it. */
  negative: boolean;
}

/**
 * Calendar difference between two dates.
 *
 * Rather than subtract the fields and borrow — which has no single right answer
 * when the start day doesn't exist in the end month — this walks whole months
 * forward from the start with {@link addMonths} and measures the remainder in
 * days. The property that buys us is *round-tripping*: `from + diff === to` for
 * every pair, using the same month-end clamping the "add / subtract" mode does.
 * So 31 Jan → 1 Mar is 1 month and 1 day (31 Jan + 1 month clamps to 28 Feb, then
 * one more day), and the two modes can never contradict each other.
 */
export function diffYMD(from: CivilDate, to: CivilDate): YearsMonthsDays {
  const negative = toDayNumber(to) < toDayNumber(from);
  const [start, end] = negative ? [to, from] : [from, to];

  let months = (end.year - start.year) * 12 + (end.month - start.month);
  // The rough month count can overshoot by one when the day of month is earlier.
  if (toDayNumber(addMonths(start, months)) > toDayNumber(end)) months -= 1;
  const days = daysBetween(addMonths(start, months), end);

  return {
    years: Math.trunc(months / 12),
    months: months % 12,
    days,
    totalDays: Math.abs(daysBetween(start, end)),
    negative
  };
}

export interface AgeResult {
  /** Completed years — 만 나이 in Korea, "age" everywhere else. */
  years: number;
  months: number;
  days: number;
  /** Days lived, inclusive of neither endpoint (the count of whole days). */
  totalDays: number;
  /**
   * Korean counting age (세는 나이): 1 at birth, +1 every 1 January. Still how
   * ages are spoken even after the 2023 legal switch to 만 나이, and how a
   * historical or contemporary Korean character would say their own age.
   */
  koreanAge: number;
  /** East-Asian age (동양 나이) by the year difference alone — 연 나이. */
  yearAge: number;
  /** Days until the next birthday; 0 on the birthday itself. */
  daysToBirthday: number;
  /** The next birthday's date (today's, when it is the birthday). */
  nextBirthday: CivilDate;
  /** Weekday index of the birth date, 0 = Sunday. */
  bornWeekday: number;
  /** True when the reference date is before the birth date. */
  unborn: boolean;
}

/**
 * Age at `on`, in every form a writer needs at once: completed years, the Korean
 * counting age, the year age, and the countdown to the next birthday.
 *
 * A 29 February birthday resolves to 1 March in common years — the convention
 * Korean and Japanese civil practice both use for the *next* birthday, and the
 * only choice that keeps the countdown from skipping three years in four.
 */
export function ageOn(birth: CivilDate, on: CivilDate): AgeResult {
  const unborn = toDayNumber(on) < toDayNumber(birth);
  const { years, months, days, totalDays } = diffYMD(birth, on);

  const thisYear = birthdayIn(birth, on.year);
  const next = toDayNumber(thisYear) >= toDayNumber(on) ? thisYear : birthdayIn(birth, on.year + 1);

  return {
    years: unborn ? 0 : years,
    months: unborn ? 0 : months,
    days: unborn ? 0 : days,
    totalDays,
    koreanAge: unborn ? 0 : on.year - birth.year + 1,
    yearAge: unborn ? 0 : on.year - birth.year,
    daysToBirthday: Math.max(0, daysBetween(on, next)),
    nextBirthday: next,
    bornWeekday: weekdayOf(birth),
    unborn
  };
}

/** The birthday as it falls in `year` — 29 Feb becomes 1 Mar in a common year. */
export function birthdayIn(birth: CivilDate, year: number): CivilDate {
  if (birth.month === 2 && birth.day === 29 && !isLeapYear(year)) {
    return { year, month: 3, day: 1 };
  }
  return { year, month: birth.month, day: Math.min(birth.day, daysInMonth(year, birth.month)) };
}

/** Units the "shift a date" mode can add or subtract. */
export type ShiftUnit = 'days' | 'weeks' | 'months' | 'years';

export function shift(date: CivilDate, amount: number, unit: ShiftUnit): CivilDate {
  switch (unit) {
    case 'days':
      return addDays(date, amount);
    case 'weeks':
      return addDays(date, amount * 7);
    case 'months':
      return addMonths(date, amount);
    case 'years':
      return addYears(date, amount);
  }
}

/** Whole weeks plus the leftover days, for the "between" readout. */
export const weeksAndDays = (totalDays: number): { weeks: number; days: number } => ({
  weeks: Math.trunc(totalDays / 7),
  days: totalDays % 7
});

// ── Parsing and formatting ──────────────────────────────────────────────────

/** `YYYY-MM-DD` — the value an `<input type="date">` reads and writes. */
export function toISO({ year, month, day }: CivilDate): string {
  const pad = (n: number, width = 2) => String(Math.abs(n)).padStart(width, '0');
  return `${year < 0 ? '-' : ''}${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Parse `YYYY-MM-DD`. Returns `null` for anything that is not a real date. */
export function parseISO(value: string): CivilDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export type DateFormat = 'iso' | 'locale' | 'dotted';

/**
 * Render a date for display and for insertion.
 *
 * `locale` goes through `toLocaleDateString` on a **UTC** timestamp: the value is
 * a civil date, so building it at local midnight would shift it a day west of
 * Greenwich. `dotted` is the Korean/Japanese `2026. 8. 22.` form.
 */
export function formatDate(date: CivilDate, format: DateFormat, locale: string): string {
  switch (format) {
    case 'iso':
      return toISO(date);
    case 'dotted':
      return `${date.year}. ${date.month}. ${date.day}.`;
    case 'locale':
      return new Date(Date.UTC(date.year, date.month - 1, date.day)).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      });
  }
}
