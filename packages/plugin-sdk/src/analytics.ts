import type { HostApi } from './host-api';

/**
 * **Analytics sections are declarative: the plugin returns data, the host draws
 * it.**
 *
 * Every other contribution surface hands the plugin a `render` and lets it own
 * its markup. This one deliberately does not. A statistics page is a design
 * system rather than a canvas — cards, type scale, chart palette, hover, motion,
 * empty states, dark mode, phone layout — and a plugin painting its own card
 * would have to re-solve all of it, then drift the first time any of it changed.
 * Describing *what* to show instead means a plugin section is pixel-identical to
 * the host's own cards, on desktop and mobile, for free and permanently.
 *
 * The split of responsibility:
 *
 * | The plugin owns | The host owns |
 * | --- | --- |
 * | Which figures matter | Card chrome, heading, spacing |
 * | The numbers themselves | Bar heights, colours, hover, tooltips |
 * | **Formatting and localization** of every displayed string | Type scale, empty/loading/error states |
 * | When to say "nothing to show" | Responsive + phone layout |
 *
 * Formatting sits with the plugin on purpose: only it knows whether `4200` is
 * characters, milliseconds or won, and how that reads in the user's language.
 * So every *displayed* value is a preformatted string, while the raw `value`
 * numbers exist purely so the host can size bars and shade cells.
 *
 * ```ts
 * this.registerAnalyticsSection({
 *   id: 'writing-time',
 *   async data({ app, range }) {
 *     const days = await app.session.history(range);
 *     const total = days.reduce((sum, d) => sum + d.activeMs, 0);
 *     if (total === 0) return { empty: '아직 기록된 집필 시간이 없습니다.' };
 *     return {
 *       stats: [{ label: '합계', value: fmt(total) }],
 *       chart: {
 *         kind: 'bars',
 *         points: days.map((d) => ({ key: d.date, value: d.activeMs, display: fmt(d.activeMs) }))
 *       }
 *     };
 *   }
 * });
 * ```
 */

/**
 * A slot in the page's chart palette — **not** a colour.
 *
 * `1..6` map to the app's `--chart-1..6`, the same categorical ramp the host's
 * own charts use, so a plugin can tell *different things* apart (written vs
 * rested, one project vs another) without ever picking a hex that clashes with
 * the user's accent, breaks in dark mode, or fails contrast. `1` is the accent
 * verbatim and the default. `muted` is the neutral tone the host uses for
 * "other" / "nothing here" — the right choice for the half of a split that
 * isn't the point.
 */
export type AnalyticsColor = 1 | 2 | 3 | 4 | 5 | 6 | 'muted';

/**
 * One headline figure, rendered like the page's own stat cards: muted label
 * above, figure below.
 */
export interface AnalyticsStat {
  /** Short caption, e.g. "합계" / "Per writing day". */
  label: string;
  /** The figure itself, **already formatted and localized** (e.g. `"3시간 20분"`). */
  value: string;
  /** Optional secondary line under the figure, for context ("최장 12일"). */
  hint?: string;
}

/**
 * One row of a ranked list — a breakdown, a leaderboard. Rendered as
 * `label … value`, with an optional magnitude bar behind the row (the same
 * treatment the host's "많이 쓴 파일" list uses).
 */
export interface AnalyticsRow {
  /** Stable identity for list keys. Falls back to `label`. */
  key?: string;
  label: string;
  /** Right-hand figure, **already formatted**. */
  value: string;
  /**
   * Palette slot for this row's magnitude bar. Defaults to `1` (the accent).
   * Give the parts of a split different slots so they read as different things.
   */
  color?: AnalyticsColor;
  /**
   * Relative magnitude in `0..1`, drawn as a soft data-bar behind the row. Omit
   * for a plain list. Out-of-range values are clamped rather than rejected, so a
   * rounding slip can't break the layout.
   */
  fraction?: number;
}

/**
 * One point of a chart. `value` is the raw magnitude the host sizes/shades from;
 * `display` is what the user reads in the tooltip.
 */
export interface AnalyticsPoint {
  /**
   * Stable identity — for a daily series, the local `YYYY-MM-DD` day key. The
   * heatmap parses this as a calendar date, so it must be a real day key there.
   */
  key: string;
  /** Raw magnitude. Negative values are treated as 0. */
  value: number;
  /** Preformatted value for the tooltip (e.g. `"12분"`). Defaults to the number. */
  display?: string;
  /** Tooltip caption, typically a localized date. Defaults to `key`. */
  label?: string;
}

/**
 * A chart the host renders from the plugin's points.
 *
 * - `bars` — one column per point, in the order given. Good for a short window
 *   (a week, a month) or any non-calendar sequence.
 * - `heatmap` — the calendar grid the writing page uses, laid out by week. Needs
 *   `key` to be a `YYYY-MM-DD` day key; gaps in the range are filled as empty
 *   days, so a plugin only has to send the days it has.
 */
export type AnalyticsChart =
  | {
      kind: 'bars';
      points: AnalyticsPoint[];
      /** Palette slot for the bars. Defaults to `1` (the accent). */
      color?: AnalyticsColor;
      /** Caption under the chart (a unit, an axis note). */
      caption?: string;
    }
  | {
      kind: 'heatmap';
      points: AnalyticsPoint[];
      caption?: string;
      /** Legend end labels. Default to the host's own "적음" / "많음". */
      legendLess?: string;
      legendMore?: string;
    };

/**
 * What a section shows. Every part is optional and rendered in a fixed order —
 * stats, chart, rows, note — so sections from different plugins stay legible
 * next to each other. A section whose data is entirely empty renders nothing at
 * all rather than an empty card.
 */
export interface AnalyticsSectionData {
  /** Headline figures, laid out in a row that wraps on narrow screens. */
  stats?: AnalyticsStat[];
  /** One chart. */
  chart?: AnalyticsChart;
  /** A ranked list under the chart. */
  rows?: AnalyticsRow[];
  /** Footnote under everything, in muted text. */
  note?: string;
  /**
   * Shown *instead of* everything else — the plugin's own way of saying "no data
   * for this window". Prefer this over returning zeroed stats, which read as a
   * broken section.
   */
  empty?: string;
}

/** Context a section's {@link AnalyticsSectionContribution.data} is resolved against. */
export interface AnalyticsSectionContext {
  app: HostApi;
  /**
   * The window the page is showing, as inclusive local `YYYY-MM-DD` days —
   * exactly the shape `app.session.history()` takes, so it can be forwarded
   * untouched.
   */
  range: { from: string; to: string };
}

/**
 * A section a plugin contributes to Settings → Analytics.
 *
 * The host calls {@link data} on mount and again whenever the page's range
 * changes, showing a placeholder while it settles. A rejected promise or a throw
 * becomes a quiet error line inside the card — the page never breaks because a
 * plugin's data source is down — and a repeatedly-throwing section is disabled
 * for the session by the same guard that protects every other contribution.
 */
export interface AnalyticsSectionContribution {
  /** Unique within the plugin. */
  id: string;
  /**
   * Card heading. Defaults to the plugin's manifest name — usually the right
   * answer, since the heading's job is to say which plugin this came from. Set
   * it only when one plugin contributes several sections.
   */
  title?: string;
  /** Optional line under the heading, for what the section measures. */
  description?: string;
  /**
   * How much of the row the card takes on a wide screen.
   *
   * - `full` (default) — the page's full width, like the year heatmap.
   * - `half` — pairs up with the next `half` section, like the host's
   *   summary + weekday cards.
   *
   * Ignored on narrow screens and phones, where every card is full width — a
   * two-column chart at 390px is worse than a stacked one.
   */
  width?: 'full' | 'half';
  /**
   * Sort key among plugin sections, ascending. Ties keep registration order.
   * Plugin sections always come after the host's own cards.
   */
  order?: number;
  data(
    ctx: AnalyticsSectionContext
  ): AnalyticsSectionData | Promise<AnalyticsSectionData>;
}
