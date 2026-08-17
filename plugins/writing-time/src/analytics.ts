import type {
  AnalyticsSectionContext,
  AnalyticsSectionData,
  SessionHistoryDay
} from '@pensiv/plugin-sdk';
import { formatDuration, STR, tr } from './i18n';

/**
 * The `registerAnalyticsSection` example — and note what isn't here: no JSX, no
 * CSS, no loading spinner, no empty state, no hover handling, no dark-mode
 * branch, no phone layout. The section returns **data**; the host draws it with
 * the analytics page's own cards, palette and motion, so it matches the page
 * exactly and keeps matching when the page changes.
 *
 * Worth copying:
 *
 *  1. **The host hands you the window.** `ctx.range` is the page's current
 *     `from`/`to`, in the exact shape `app.session.history()` takes — forward it
 *     untouched and the section follows the page's range selector for free.
 *  2. **Format every displayed string yourself.** Only the plugin knows that
 *     these numbers are milliseconds, and how "3시간 20분" reads in the user's
 *     language. Raw `value` numbers exist only so the host can size the bars.
 *  3. **Say "nothing yet" explicitly.** Returning `{ empty }` reads better than
 *     a wall of zeroes, which looks like a broken section.
 *  4. **Don't fight for the reader's attention.** Word/character totals live in
 *     the host's own cards; this section answers one question — how long.
 */

/** Longest run of consecutive days matching `writing`, in a chronological list. */
function longestRun(days: SessionHistoryDay[], writing: boolean): number {
  let best = 0;
  let run = 0;
  for (const day of days) {
    if (day.activeMs > 0 === writing) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

/** Whole days, for the rhythm card's counts. */
function daysLabel(app: Parameters<typeof tr>[0], count: number): string {
  return `${count}${tr(app, STR.daysUnit)}`;
}

/** Average over days actually written on, not calendar days. */
function averageMs(days: SessionHistoryDay[], totalMs: number): number {
  const written = days.filter((d) => d.activeMs > 0).length;
  return written > 0 ? totalMs / written : 0;
}

export async function writingTimeSection(
  ctx: AnalyticsSectionContext
): Promise<AnalyticsSectionData> {
  const { app, range } = ctx;

  // Feature-detect rather than raising the manifest's `sdk` floor: that gates the
  // whole plugin, and the timer — the reason people install this — works fine on
  // an older host. A mobile build can legitimately sit a release behind.
  if (typeof app.session.history !== 'function') {
    return { empty: tr(app, STR.analyticsUnavailable) };
  }

  const days = await app.session.history(range);
  const totalMs = days.reduce((sum, d) => sum + d.activeMs, 0);
  if (totalMs === 0) return { empty: tr(app, STR.analyticsEmpty) };

  const best = days.reduce((top, d) => (d.activeMs > top.activeMs ? d : top), days[0]!);

  return {
    stats: [
      { label: tr(app, STR.analyticsTotal), value: formatDuration(app, totalMs) },
      {
        label: tr(app, STR.analyticsAverage),
        value: formatDuration(app, averageMs(days, totalMs))
      },
      {
        label: tr(app, STR.analyticsBest),
        value: formatDuration(app, best.activeMs),
        hint: best.date
      }
    ],
    chart: {
      kind: 'bars',
      points: days.map((d) => ({
        key: d.date,
        value: d.activeMs,
        label: d.date,
        display: formatDuration(app, d.activeMs)
      }))
    }
  };
}


/**
 * The rhythm card: the same window seen as a **ratio** rather than a total —
 * how much of it was spent writing versus resting.
 *
 * Day-based, not clock-based, on purpose. "16 minutes out of 720 hours" is
 * technically true and useless; "you wrote on 12 of 30 days, longest break 7
 * days" is the shape of the habit the numbers are actually about.
 */
export async function writingRhythmSection(
  ctx: AnalyticsSectionContext
): Promise<AnalyticsSectionData> {
  const { app, range } = ctx;

  if (typeof app.session.history !== 'function') {
    return { empty: tr(app, STR.analyticsUnavailable) };
  }

  const days = await app.session.history(range);
  const total = days.length;
  if (total === 0) return { empty: tr(app, STR.analyticsEmpty) };

  const wrote = days.filter((d) => d.activeMs > 0).length;
  const rested = total - wrote;
  if (wrote === 0) return { empty: tr(app, STR.analyticsEmpty) };

  const share = wrote / total;
  const pct = (fraction: number): string => `${Math.round(fraction * 100)}%`;

  return {
    stats: [
      {
        label: tr(app, STR.rhythmShare),
        value: pct(share),
        hint: tr(app, STR.ofDays).replace('{{total}}', String(total))
      },
      { label: tr(app, STR.rhythmLongestRun), value: daysLabel(app, longestRun(days, true)) },
      { label: tr(app, STR.rhythmLongestGap), value: daysLabel(app, longestRun(days, false)) }
    ],
    // Two rows whose bars sum to the whole period, so the split is readable at a
    // glance without a pie chart the host would have to invent.
    rows: [
      {
        key: 'wrote',
        label: tr(app, STR.rhythmWrote),
        value: `${daysLabel(app, wrote)} · ${pct(share)}`,
        fraction: share
      },
      {
        key: 'rested',
        label: tr(app, STR.rhythmRested),
        value: `${daysLabel(app, rested)} · ${pct(1 - share)}`,
        fraction: 1 - share
      }
    ]
  };
}
