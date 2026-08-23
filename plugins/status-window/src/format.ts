/**
 * Turning a typed value into the string a serial actually prints.
 *
 * Every rule here was read off a real work rather than designed; the sources are
 * catalogued in `docs/status-window-formats.md` in the app repo. Where a source
 * looked inconsistent it turned out not to be — see {@link formatStat}.
 */
import type { AttributeValue } from './model';

/** Convention knobs a preset sets once and every value here obeys. */
export interface FormatOptions {
  /** `1,240` (LitRPG) vs `1240` (Korean / Japanese, which never group). */
  thousands: boolean;
  /** Fixed decimals for a resource's regeneration — `0.70`. Omit for as-typed. */
  regenDecimals?: number;
  /** Word before a resource's regen figure. `재생`, `regen`, `再生`. */
  regenLabel: string;
  /** Suffix after it. `/분`, `/min`, `/分`. */
  regenSuffix: string;
  /** Separator between a previous and current value in a diff. */
  arrow: string;
  /** Filled and empty cells of a progress bar, in that order. */
  barChars: readonly [string, string];
  /** Bar length in cells. */
  barWidth: number;
  /** Separator when a list renders inline. `、` in Japanese, `, ` elsewhere. */
  listJoin: string;
}

export const DEFAULT_FORMAT: FormatOptions = {
  thousands: false,
  regenLabel: '재생',
  regenSuffix: '/분',
  arrow: ' → ',
  barChars: ['█', '░'],
  barWidth: 10,
  listJoin: ', '
};

/** Group digits with commas. Only LitRPG does this; Korean and Japanese don't. */
export function formatNumber(n: number, options: FormatOptions): string {
  if (!options.thousands) return String(n);
  const [whole, fraction] = String(n).split('.');
  const grouped = (whole ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

/**
 * `415(+566)` · `298(+260 밸런스 한계치)[D]` · `149(+187 −50)[E]` · `14 [F]`
 *
 * ## The space before the grade is a rule, not a typo
 *
 * `회귀도 13번이면 지랄 맞다` prints `14 [F]` but `16(+2)[F]` — a space before the
 * bracket in one and none in the other. Across all ten lines of that block the
 * pattern holds without exception: **the bracket hugs a closing paren, and takes
 * a space after a bare number.** That is ordinary typesetting (two adjacent
 * digits and a bracket need air; a paren already provides it), so it is
 * reproduced rather than normalised away.
 *
 * `note` trails the bonus inside the parens because that is where the sources
 * put it, and it is free text because they put anything there — a cap name
 * (`밸런스 한계치`), a second modifier (`−50`).
 */
export function formatStat(
  value: Extract<AttributeValue, { kind: 'stat' }>,
  options: FormatOptions
): string {
  const base = formatNumber(value.base, options);
  const note = value.note?.trim();
  const hasBonus = value.bonus !== undefined && value.bonus !== 0;

  let out = base;
  if (hasBonus) {
    const bonus = value.bonus as number;
    const sign = bonus < 0 ? '−' : '+';
    const magnitude = formatNumber(Math.abs(bonus), options);
    out += note ? `(${sign}${magnitude} ${note})` : `(${sign}${magnitude})`;
  } else if (note) {
    // A note with no bonus still belongs in parens — otherwise it would run
    // straight into the number.
    out += `(${note})`;
  }

  const grade = value.grade?.trim();
  if (grade) out += hasBonus || note ? `[${grade}]` : ` [${grade}]`;
  return out;
}

/** `70/70 재생 0.70/분` — the pool, then regeneration if there is any. */
export function formatResource(
  value: Extract<AttributeValue, { kind: 'resource' }>,
  options: FormatOptions
): string {
  const pool = `${formatNumber(value.cur, options)}/${formatNumber(value.max, options)}`;
  if (value.regen === undefined || value.regen === 0) return pool;
  const regen =
    options.regenDecimals === undefined
      ? formatNumber(value.regen, options)
      : value.regen.toFixed(options.regenDecimals);
  const label = options.regenLabel ? `${options.regenLabel} ` : '';
  return `${pool} ${label}${regen}${options.regenSuffix}`;
}

/** Percent complete, floored — 3/4 essences is 75%, and 3.9/4 is not 100%. */
export function gaugePercent(value: Extract<AttributeValue, { kind: 'gauge' }>): number {
  if (value.max <= 0) return 0;
  return Math.floor((value.cur / value.max) * 100);
}

/** `0% (0/4 에센스)` — the headline number, with its fraction in support. */
export function formatGauge(
  value: Extract<AttributeValue, { kind: 'gauge' }>,
  options: FormatOptions
): string {
  const fraction = `${formatNumber(value.cur, options)}/${formatNumber(value.max, options)}`;
  const unit = value.unit?.trim();
  return `${gaugePercent(value)}% (${fraction}${unit ? ` ${unit}` : ''})`;
}

/** `████░░░░░░` — LitRPG's XP bar. Empty when there is nothing to fill. */
export function formatBar(percent: number, options: FormatOptions): string {
  const [filled, empty] = options.barChars;
  const clamped = Math.max(0, Math.min(100, percent));
  const cells = Math.round((clamped / 100) * options.barWidth);
  return filled.repeat(cells) + empty.repeat(Math.max(0, options.barWidth - cells));
}

/** The value as the serial prints it, whatever kind it is. */
export function formatValue(value: AttributeValue, options: FormatOptions): string {
  switch (value.kind) {
    case 'text':
      return value.text;
    case 'number':
      return formatNumber(value.n, options);
    case 'stat':
      return formatStat(value, options);
    case 'resource':
      return formatResource(value, options);
    case 'gauge':
      return formatGauge(value, options);
    case 'rank':
      return value.grade;
    case 'list':
      // The template may iterate `{{#items}}` for one-per-line layouts; this is
      // the inline form, joined with whatever the convention uses.
      return value.items.filter((item) => item.trim() !== '').join(options.listJoin);
  }
}

/**
 * The raw magnitude, without decoration — `415` from `415(+566)`.
 *
 * Templates use it when they want to lay out the parts themselves rather than
 * take the composed string.
 */
export function rawValue(value: AttributeValue, options: FormatOptions): string {
  switch (value.kind) {
    case 'stat':
      return formatNumber(value.base, options);
    case 'number':
      return formatNumber(value.n, options);
    case 'resource':
      return formatNumber(value.cur, options);
    case 'gauge':
      return formatNumber(value.cur, options);
    default:
      return formatValue(value, options);
  }
}

/**
 * `14 [F] → 16(+2)[F]` — the growth line.
 *
 * Returns just the current value when nothing changed, so a template can carry
 * `{{arrow}}` unconditionally and get a plain value on episodes where the stat
 * held steady.
 */
export function formatArrow(
  previous: AttributeValue | undefined,
  current: AttributeValue,
  options: FormatOptions
): string {
  const now = formatValue(current, options);
  if (previous === undefined) return now;
  const before = formatValue(previous, options);
  return before === now ? now : `${before}${options.arrow}${now}`;
}

/**
 * The signed change between two numeric values — `+2`, `−50`.
 *
 * Empty for non-numeric kinds and for no change, which makes `{{#delta}}` a
 * clean mustache falsy test in a template.
 */
export function formatDelta(
  previous: AttributeValue | undefined,
  current: AttributeValue,
  options: FormatOptions
): string {
  const before = numericOf(previous);
  const after = numericOf(current);
  if (before === undefined || after === undefined) return '';
  const change = after - before;
  if (change === 0) return '';
  const sign = change < 0 ? '−' : '+';
  return `${sign}${formatNumber(Math.abs(change), options)}`;
}

/** The number a value is "worth", for delta arithmetic. */
function numericOf(value: AttributeValue | undefined): number | undefined {
  if (!value) return undefined;
  switch (value.kind) {
    case 'number':
      return value.n;
    // The base is what grows; a bonus is the equipment currently worn, and
    // counting it would report a stat gain every time the character swaps gear.
    case 'stat':
      return value.base;
    case 'resource':
      return value.max;
    case 'gauge':
      return value.cur;
    default:
      return undefined;
  }
}
