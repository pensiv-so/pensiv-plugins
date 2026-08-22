import type { HostApi } from '@pensiv/plugin-sdk';
import {
  ageOn,
  daysBetween,
  diffYMD,
  formatDate,
  parseISO,
  shift,
  weekdayOf,
  weeksAndDays,
  type CivilDate
} from './engine';
import type { DateSettings } from './settings';
import type { Mode } from './store';
import { AGE_UNIT, baseLocale, countLabel, L, STR, tr, UNIT, WEEKDAYS } from './i18n';

/**
 * Turns the three modes into one shape the panel can render without knowing
 * which mode it is in: a headline, a list of rows under it, and the two strings
 * the copy / insert buttons produce.
 *
 * The arithmetic all lives in `engine.ts`; this file is only *phrasing* — which
 * is exactly the part that differs per language, so it is kept out of the views.
 */
export interface Readout {
  /**
   * Whether there is an answer to show. `false` means the inputs aren't complete
   * yet — the panel renders *nothing*, rather than an empty box telling the user
   * to fill in the field they are already looking at.
   */
  ready: boolean;
  /** The one number or date the surface leads with. */
  headline: string;
  /** A caption under the headline (the exact breakdown, a warning). */
  caption?: string;
  /** Secondary `label — value` rows. */
  rows: Array<{ label: string; value: string; note?: string }>;
  /** What copy / insert write, per the insert-format setting. */
  insertValue: string;
  insertSummary: string;
  /**
   * A one-line remark shown on its own when there is no answer — reserved for a
   * real conflict (a reference date before the birth date), never for "you
   * haven't typed anything yet".
   */
  note?: string;
}

interface Input {
  app: HostApi;
  settings: DateSettings;
  today: CivilDate;
  mode: Mode;
  birth: string;
  reference: string;
  from: string;
  to: string;
  shiftBase: string;
  shiftAmount: number;
  shiftUnit: 'days' | 'weeks' | 'months' | 'years';
  shiftSign: 1 | -1;
}

const weekdayName = (app: HostApi, date: CivilDate): string =>
  tr(app, WEEKDAYS[weekdayOf(date)] ?? WEEKDAYS[0]!);

/** "3 years, 2 months, 5 days", with empty parts dropped rather than shown as 0. */
const ymdPhrase = (
  app: HostApi,
  parts: { years: number; months: number; days: number }
): string => {
  const pieces: string[] = [];
  if (parts.years) pieces.push(countLabel(app, parts.years, UNIT.year));
  if (parts.months) pieces.push(countLabel(app, parts.months, UNIT.month));
  if (parts.days || pieces.length === 0) pieces.push(countLabel(app, parts.days, UNIT.day));
  // Korean and Japanese run the parts together; English needs the commas.
  const locale = baseLocale(app);
  return locale === 'en' ? pieces.join(', ') : pieces.join(' ');
};

/** "28 years old" / "만 28세" / "満28歳" — the headline of the age mode. */
const ageHeadline = (app: HostApi, years: number): string => {
  const locale = baseLocale(app);
  if (locale === 'ko') return `만 ${years}세`;
  if (locale === 'ja') return `満${years}歳`;
  return `${years} ${years === 1 ? 'year' : 'years'} old`;
};

export function buildReadout(input: Input): Readout {
  const { app, settings, today } = input;
  const fmt = (date: CivilDate) => formatDate(date, settings.dateFormat, app.app.locale ?? 'en');
  /* Nothing to say yet (or a conflict worth one line) — the panel then draws
   * neither a result block nor a prompt. */
  const empty = (note?: string): Readout => ({
    ready: false,
    headline: '',
    rows: [],
    insertValue: '',
    insertSummary: '',
    note
  });

  if (input.mode === 'age') {
    const birth = parseISO(input.birth);
    if (!birth) return empty();
    const on = parseISO(input.reference) ?? today;
    const age = ageOn(birth, on);
    if (age.unborn) return empty(tr(app, STR.unborn));

    const rows: Readout['rows'] = [];
    if (settings.showKoreanAge) {
      rows.push({
        label: tr(app, STR.koreanAge),
        value: countLabel(app, age.koreanAge, AGE_UNIT),
        note: tr(app, STR.koreanAgeNote)
      });
    }
    if (settings.showYearAge) {
      rows.push({
        label: tr(app, L('Year age', '연 나이', '年齢（年差）')),
        value: countLabel(app, age.yearAge, AGE_UNIT)
      });
    }
    rows.push({
      label: tr(app, STR.nextBirthday),
      value:
        age.daysToBirthday === 0
          ? tr(app, STR.birthdayToday)
          : `${fmt(age.nextBirthday)} · ${countLabel(app, age.daysToBirthday, UNIT.day)}`
    });
    rows.push({
      label: tr(app, STR.daysLived),
      value: countLabel(app, age.totalDays, UNIT.day)
    });
    rows.push({ label: tr(app, STR.bornOn), value: weekdayName(app, birth) });

    const headline = ageHeadline(app, age.years);
    return {
      ready: true,
      headline,
      caption: ymdPhrase(app, age),
      rows,
      insertValue: headline,
      insertSummary: `${fmt(birth)} → ${fmt(on)} · ${headline}`
    };
  }

  if (input.mode === 'between') {
    const from = parseISO(input.from);
    const to = parseISO(input.to);
    if (!from || !to) return empty();

    const raw = daysBetween(from, to);
    const backwards = raw < 0;
    // "Count the end date" turns a span into an inclusive count — the difference
    // between "two nights away" and "a three-day trip".
    const total = Math.abs(raw) + (settings.includeEndDate ? 1 : 0);
    const parts = diffYMD(from, to);
    const { weeks, days } = weeksAndDays(total);

    const headline = countLabel(app, total, UNIT.day);
    const rows: Readout['rows'] = [
      { label: tr(app, STR.duration), value: ymdPhrase(app, parts) },
      {
        label: tr(app, STR.inWeeks),
        value:
          days === 0
            ? countLabel(app, weeks, UNIT.week)
            : `${countLabel(app, weeks, UNIT.week)} ${countLabel(app, days, UNIT.day)}`
      },
      { label: tr(app, STR.startDate), value: `${fmt(from)} · ${weekdayName(app, from)}` },
      { label: tr(app, STR.endDate), value: `${fmt(to)} · ${weekdayName(app, to)}` }
    ];

    return {
      ready: true,
      headline,
      caption: backwards ? tr(app, STR.reversed) : undefined,
      rows,
      insertValue: headline,
      insertSummary: `${fmt(from)} → ${fmt(to)} · ${headline}`
    };
  }

  const base = parseISO(input.shiftBase);
  if (!base) return empty();
  const amount = Number.isFinite(input.shiftAmount) ? Math.trunc(input.shiftAmount) : 0;
  const result = shift(base, amount * input.shiftSign, input.shiftUnit);
  const fromToday = daysBetween(today, result);

  const headline = fmt(result);
  const rows: Readout['rows'] = [
    { label: tr(app, STR.weekday), value: weekdayName(app, result) },
    {
      label: tr(app, STR.fromNow),
      value:
        fromToday === 0
          ? tr(app, STR.today)
          : `${countLabel(app, Math.abs(fromToday), UNIT.day)}${fromToday < 0 ? ` ${tr(app, STR.ago)}` : ''}`
    },
    { label: tr(app, STR.baseDate), value: `${fmt(base)} · ${weekdayName(app, base)}` }
  ];

  const signedAmount = `${input.shiftSign < 0 ? '−' : '+'}${countLabel(app, Math.abs(amount), UNIT[unitKey(input.shiftUnit)])}`;
  return {
    ready: true,
    headline,
    caption: signedAmount,
    rows,
    insertValue: headline,
    insertSummary: `${fmt(base)} ${signedAmount} = ${headline}`
  };
}

const unitKey = (unit: Input['shiftUnit']): keyof typeof UNIT => {
  switch (unit) {
    case 'days':
      return 'day';
    case 'weeks':
      return 'week';
    case 'months':
      return 'month';
    case 'years':
      return 'year';
  }
};
