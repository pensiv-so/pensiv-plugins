import * as React from 'react';
import { Plugin, type WidgetProps } from '@pensiv/plugin-sdk';
import './styles.css';
import { formatDuration, L, STR, tr } from './i18n';
import { DEFAULT_TARGET_MINUTES, goalPercent, targetMinutes, useActiveMs } from './session';
import { WritingTimeSheet } from './sheet';
import { writingRhythmSection, writingTimeSection } from './analytics';

/**
 * The reference example for the session lifecycle — `app.session.activeMs()`
 * plus the `write-start` / `write-stop` / `tick` events, and `app.ui.openSheet`.
 *
 * Worth copying:
 *
 *  1. **`activeMs` is *writing* time, not app-open time.** The host accumulates
 *     wall clock between consecutive edits and drops any gap longer than its idle
 *     window, so a coffee break is not counted. It is device-local and resets at
 *     local midnight.
 *  2. **`tick` only fires while the user is actually writing.** That is what
 *     makes a live counter cheap: no interval of your own, and nothing running
 *     while the user is reading.
 *  3. **One shared hook, three surfaces.** The chip, the floating card and the
 *     phone sheet all read the same state, so they can never disagree.
 *  4. **Look native or don't ship it.** The card reuses the app's floating-widget
 *     chrome, ghost buttons and `label — value` rows (see
 *     {@link file://./styles.css}); the phone sheet is composed from the host UI
 *     kit rather than hand-styled. Nothing here invents its own visual language.
 */

const CogIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="1rem"
    height="1rem"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/**
 * A `label — value` line, baseline-aligned (native widget parity). With
 * `percent`, the share trails the value in muted ink — the analytics legend's
 * `value · 70%` shape.
 */
const Row: React.FC<{ label: string; value: string; percent?: number }> = ({
  label,
  value,
  percent
}) => (
  <div className="pnsv-wt-row">
    <span className="pnsv-wt-label">{label}</span>
    <span className="pnsv-wt-value">
      {value}
      {percent === undefined ? null : <span className="pnsv-wt-pct">· {percent}%</span>}
    </span>
  </div>
);

/**
 * Compact tray pill content (mobile). The host owns the pill chrome; white +
 * difference blend so the value reads on any chip tint — same recipe as the
 * native Timer and Daily Goal chips.
 */
export function TimeChip({ app }: WidgetProps) {
  const { ms, writing } = useActiveMs(app);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        color: '#fff',
        mixBlendMode: 'difference'
      }}
    >
      <span
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          opacity: writing ? 1 : 0.7
        }}
      >
        {formatDuration(app, ms)}
      </span>
    </span>
  );
}

/**
 * Mount grow-in flag, mirroring the app's `useChartGrowIn`: render the bar
 * collapsed on the first paint, flip on the next frame, and let the CSS
 * transition do the rest — so it grows in like the analytics charts, and later
 * value changes morph on the same curve. Instant under reduced motion.
 */
function useGrowIn(): boolean {
  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [grown, setGrown] = React.useState(reduced);

  React.useEffect(() => {
    if (reduced) return;
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return grown;
}

/** Floating card (desktop / tablet). The host owns drag + corner snap. */
export function TimeCard({ app }: WidgetProps) {
  const { ms, writing } = useActiveMs(app);

  const minutes = targetMinutes(app);
  const pct = goalPercent(app, ms);
  const grown = useGrowIn();

  return (
    <div className="pnsv-wt-card" role="status" aria-live="polite">
      <div className="pnsv-wt-stack">
        <div className="pnsv-wt-head">
          <span className="pnsv-wt-title">{tr(app, STR.title)}</span>
          <button
            type="button"
            className="pnsv-wt-cog"
            title={tr(app, STR.settings)}
            aria-label={tr(app, STR.settings)}
            onClick={() => app.ui.openSettings()}
          >
            <CogIcon />
          </button>
        </div>

        <div className="pnsv-wt-body">
          <span className="pnsv-wt-time">{formatDuration(app, ms)}</span>
          <span className={`pnsv-wt-status${writing ? ' live' : ''}`}>
            <span className="pnsv-wt-dot" />
            {writing ? tr(app, STR.writingNow) : tr(app, STR.idle)}
          </span>
        </div>

        {/* Word/character totals deliberately live in the Daily Goal widget, not
            here: two cards in one corner repeating the same numbers is noise.
            This card answers one question — how long have I been writing. */}
        {minutes > 0 ? (
          <div className="pnsv-wt-body">
            <Row
              label={tr(app, STR.dailyGoal)}
              value={formatDuration(app, minutes * 60_000)}
              percent={pct}
            />
          </div>
        ) : null}

        {minutes > 0 ? (
          <div
            className="pnsv-wt-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <span className="pnsv-wt-fill" style={{ width: `${grown ? pct : 0}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default class WritingTimePlugin extends Plugin {
  onload(): void {
    this.registerWidget({
      id: 'writing-time',
      surface: 'floating',
      frame: 'floating',
      defaultCorner: 'bottom-right',
      storageKey: 'writing-time-widget',
      component: TimeCard,
      chip: TimeChip,
      // Phone bottom sheet: composed from the host UI kit so it matches every
      // other plugin sheet, rather than dropping the floating card into a sheet.
      sheet: WritingTimeSheet,
      // Shown by default (like the native Daily Goal widget) and hideable from
      // the setting below; phones get the tray chip instead.
      shouldRender: ({ app }) => app.storage.get<boolean>('floating') ?? true,
      chipShouldRender: () => true
    });

    this.addSettingTab({
      title: tr(this.app, STR.title),
      schema: {
        fields: [
          {
            key: 'targetMinutes',
            type: 'number',
            label: STR.target,
            description: STR.targetDesc,
            default: DEFAULT_TARGET_MINUTES,
            min: 0,
            max: 1440
          },
          {
            key: 'dayStartHour',
            type: 'select',
            label: STR.dayStart,
            description: STR.dayStartDesc,
            default: '0',
            options: [
              { value: '0', label: L('00:00', '00:00', '00:00') },
              { value: '1', label: L('01:00', '01:00', '01:00') },
              { value: '2', label: L('02:00', '02:00', '02:00') },
              { value: '3', label: L('03:00', '03:00', '03:00') },
              { value: '4', label: L('04:00', '04:00', '04:00') },
              { value: '5', label: L('05:00', '05:00', '05:00') },
              { value: '6', label: L('06:00', '06:00', '06:00') },
              { value: '7', label: L('07:00', '07:00', '07:00') },
              { value: '8', label: L('08:00', '08:00', '08:00') },
              { value: '9', label: L('09:00', '09:00', '09:00') },
              { value: '10', label: L('10:00', '10:00', '10:00') },
              { value: '11', label: L('11:00', '11:00', '11:00') },
              { value: '12', label: L('12:00', '12:00', '12:00') },
              { value: '13', label: L('13:00', '13:00', '13:00') },
              { value: '14', label: L('14:00', '14:00', '14:00') },
              { value: '15', label: L('15:00', '15:00', '15:00') },
              { value: '16', label: L('16:00', '16:00', '16:00') },
              { value: '17', label: L('17:00', '17:00', '17:00') },
              { value: '18', label: L('18:00', '18:00', '18:00') },
              { value: '19', label: L('19:00', '19:00', '19:00') },
              { value: '20', label: L('20:00', '20:00', '20:00') },
              { value: '21', label: L('21:00', '21:00', '21:00') },
              { value: '22', label: L('22:00', '22:00', '22:00') },
              { value: '23', label: L('23:00', '23:00', '23:00') },
            ]
          },
          {
            key: 'floating',
            type: 'toggle',
            label: STR.showFloating,
            description: STR.showFloatingDesc,
            default: true,
            // Phones use the tray chip instead of a floating card.
            formFactors: ['desktop', 'tablet', 'web']
          }
        ]
      }
    });

    // A section on Settings → Analytics. Declarative on purpose: this hands back
    // figures and a per-day series, and the host renders them with the page's own
    // cards, palette and hover — so it matches the page and keeps matching.
    this.registerAnalyticsSection({
      id: 'writing-time',
      title: tr(this.app, STR.analyticsDaily),
      width: 'half',
      order: 0,
      data: writingTimeSection
    });

    // The same window as a ratio — how much of the period was writing and how
    // much was rest. Paired at half width so the two read as one thought.
    this.registerAnalyticsSection({
      id: 'writing-rhythm',
      title: tr(this.app, STR.rhythmTitle),
      width: 'half',
      order: 1,
      data: writingRhythmSection
    });

    // `openSheet` hands the host a body and lets it pick the surface — a dialog
    // on desktop, a real bottom sheet on mobile.
    this.addCommand({
      id: 'show-today',
      name: tr(this.app, STR.summaryCommand),
      run: () => this.app.ui.openSheet(<WritingTimeSheet app={this.app} />)
    });
  }
}
