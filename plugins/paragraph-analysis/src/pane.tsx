import * as React from 'react';
import type { HostApi, PaneViewProps } from '@pensiv/plugin-sdk';

import {
  analyzeDoc,
  analyzeDocs,
  PARAGRAPH_KINDS,
  type ParagraphAnalysis,
  type ParagraphKind
} from './analyze';
import {
  formatChars,
  formatDecimal,
  formatItems,
  formatParagraphs,
  formatPercent,
  kindLabel,
  STR,
  tr
} from './i18n';
import { CHART_EASE, CHART_GROW_MS, useGrowIn, useRollingNumber } from './motion';
import { KEYS, readOptions } from './settings';

/**
 * Palette slots, not colours. `--chart-1..4` is the analytics page's categorical
 * ramp, so the four buckets stay distinguishable in both themes and never clash
 * with the user's accent.
 */
const KIND_COLOR: Record<ParagraphKind, string> = {
  narration: 'hsl(var(--chart-1))',
  dialogue: 'hsl(var(--chart-2))',
  monologue: 'hsl(var(--chart-3))',
  special: 'hsl(var(--chart-4))'
};

export type Scope = 'file' | 'project';

/** Every settings key the analysis depends on — a write to any of them re-runs it. */
const OPTION_KEYS = Object.values(KEYS).filter((key) => key !== KEYS.scope);

/**
 * Recompute on a trailing edge only.
 *
 * A manuscript-sized document is a few thousand paragraphs, and the walk is
 * cheap — but it is not free, and running it inside the keystroke path is how a
 * stats pane turns into typing lag. 400ms is below the threshold where the
 * number feels stale and far above the inter-keystroke interval.
 */
const DEBOUNCE_MS = 400;

/** Read every prose file in the project. Returns `null` when the host won't serve them. */
const projectDocs = (app: HostApi): unknown[] | null => {
  try {
    if (!app.project?.available) return null;
    return app.project
      .query({ type: ['document', 'sheet'] })
      .map((file) => app.project.content(file.id)?.doc)
      .filter((doc): doc is unknown => doc !== undefined);
  } catch {
    // A revoked `project.read` throws rather than returning empty; the pane
    // should say "can't read this" instead of "your project is empty".
    return null;
  }
};

/** The analysis for a scope, kept live against the editor, the project and the settings. */
export const useAnalysis = (
  app: HostApi,
  scope: Scope,
  fileId?: string
): { analysis: ParagraphAnalysis | null; unavailable: boolean } => {
  const [state, setState] = React.useState<{
    analysis: ParagraphAnalysis | null;
    unavailable: boolean;
  }>({ analysis: null, unavailable: false });

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const compute = () => {
      if (disposed) return;
      // Options are read per run rather than captured: a settings change then
      // lands on the next recompute even if its storage event never arrives.
      const options = readOptions(app);
      if (scope === 'project') {
        const docs = projectDocs(app);
        if (!docs) {
          setState({ analysis: null, unavailable: true });
          return;
        }
        setState({ analysis: analyzeDocs(docs, options), unavailable: false });
        return;
      }
      let doc: unknown = null;
      try {
        doc = app.editor.getDoc();
      } catch {
        doc = null;
      }
      setState({ analysis: doc ? analyzeDoc(doc, options) : null, unavailable: false });
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(compute, DEBOUNCE_MS);
    };

    compute();

    const unsubs: Array<() => void> = [];
    if (scope === 'file') {
      try {
        unsubs.push(app.editor.on('update', schedule));
      } catch {
        /* an editorless pane just shows the empty state */
      }
    } else {
      try {
        unsubs.push(app.project.subscribe(schedule));
      } catch {
        /* no project events: the numbers still settle on remount / settings change */
      }
    }
    for (const key of OPTION_KEYS) {
      try {
        unsubs.push(app.storage.on(key, schedule));
      } catch {
        /* older host without storage events */
      }
    }

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      for (const unsub of unsubs) unsub();
    };
  }, [app, scope, fileId]);

  return state;
};

// ── the app's segmented control ─────────────────────────────────────────────

/**
 * Measure the active tab so the pill can be placed on it.
 *
 * The host's `SegmentedTabs` does the same thing for the same reason: segments
 * hold text, so their widths differ per label and per locale — `현재 문서` and
 * `Project` are not the same box. Assuming an even split would leave the pill
 * short of one label in every language but the one it was tuned in.
 */
const useTabIndicator = (
  active: string,
  values: readonly string[]
): {
  listRef: React.RefObject<HTMLDivElement>;
  registerTab: (value: string) => (node: HTMLButtonElement | null) => void;
  indicator: { x: number; width: number } | null;
} => {
  const listRef = React.useRef<HTMLDivElement>(null);
  const tabs = React.useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = React.useState<{ x: number; width: number } | null>(null);

  const measure = React.useCallback(() => {
    const node = tabs.current.get(active);
    const list = listRef.current;
    if (!node || !list) return;
    setIndicator({ x: node.offsetLeft, width: node.offsetWidth });
  }, [active]);

  React.useLayoutEffect(() => {
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // The pane is resizable, and a narrower pane re-wraps the labels — so the
    // pill has to be re-measured, not just re-positioned.
    const observer = new ResizeObserver(measure);
    if (listRef.current) observer.observe(listRef.current);
    return () => observer.disconnect();
  }, [measure, values.length]);

  const registerTab = React.useCallback(
    (value: string) => (node: HTMLButtonElement | null) => {
      if (node) tabs.current.set(value, node);
      else tabs.current.delete(value);
    },
    []
  );

  return { listRef, registerTab, indicator };
};

/**
 * Underline tabs: labels on the pane's own surface with a rule beneath them and
 * a short bar sliding under the active one.
 *
 * The analytics page's pill control is a *filter over a chart* and reads that
 * way — a raised control floating above content. This pane has no cards left to
 * float above, so the same pill would be the heaviest object in a flat layout.
 * The underline keeps the scope switch legible while leaving the numbers as the
 * only thing with weight.
 *
 * The slide reuses the host's grow-in easing, so it belongs to the same motion
 * family as the bar below it.
 */
const ScopeTabs: React.FC<{
  app: HostApi;
  value: Scope;
  onChange: (next: Scope) => void;
}> = ({ app, value, onChange }) => {
  const values = React.useMemo(() => ['file', 'project'] as const, []);
  const { listRef, registerTab, indicator } = useTabIndicator(value, values);

  return (
    <div className="pnsv-pa-tabs" ref={listRef} role="tablist">
      {indicator ? (
        <span
          aria-hidden
          className="pnsv-pa-tabs-underline"
          style={{
            transform: `translateX(${indicator.x}px)`,
            width: `${indicator.width}px`
          }}
        />
      ) : null}
      {values.map((option) => (
        <button
          key={option}
          ref={registerTab(option)}
          type="button"
          role="tab"
          aria-selected={value === option}
          className="pnsv-pa-tab"
          data-active={value === option ? 'true' : undefined}
          onClick={() => onChange(option)}
        >
          {tr(app, option === 'file' ? STR.scopeFile : STR.scopeProject)}
        </button>
      ))}
    </div>
  );
};

// ── stat tiles ──────────────────────────────────────────────────────────────

/**
 * The analytics `StatCard`'s proportions — muted `text-sm` label, one line of
 * `text-lg tracking-tight`, optional `text-xs` hint — on a plain tinted tile
 * instead of a bordered card. A side pane is narrow enough that four bordered
 * cards inside a bordered tray read as boxes-in-boxes; the fill alone separates
 * them, and the figures carry the hierarchy.
 *
 * The figure counts up on mount and morphs on every later change, like every
 * other headline number in the app.
 */
const Stat: React.FC<{
  label: string;
  value: number;
  format: (value: number) => string;
  hint?: string;
}> = ({ label, value, format, hint }) => {
  const rolling = useRollingNumber(value);
  return (
    <div className="pnsv-pa-stat">
      <span className="pnsv-pa-stat-label">{label}</span>
      <span className="pnsv-pa-stat-value">{format(rolling)}</span>
      {hint ? <span className="pnsv-pa-stat-hint">{hint}</span> : null}
    </div>
  );
};

// ── the app's segmented bar ─────────────────────────────────────────────────

/**
 * `SegmentedBar`, verbatim in shape: a `0.5rem` pill track split by hairline
 * gaps, segments sized by `flex-grow` so they always fill it exactly, each
 * floored at a visible sliver once grown. Share is encoded by width; the numbers
 * live in the legend, so nothing is written on the bar itself.
 */
const ShareBar: React.FC<{ app: HostApi; analysis: ParagraphAnalysis }> = ({ app, analysis }) => {
  const { grown, animate } = useGrowIn();
  const segments = analysis.kinds.filter((stat) => stat.paragraphs > 0);
  if (segments.length === 0) return null;

  return (
    <div className="pnsv-pa-bar">
      {segments.map((stat) => (
        <span
          key={stat.kind}
          className="pnsv-pa-bar-seg"
          title={`${kindLabel(app, stat.kind)} · ${formatParagraphs(app, stat.paragraphs)}`}
          style={{
            flexGrow: grown ? stat.paragraphs : 0,
            flexShrink: 1,
            flexBasis: '0%',
            minWidth: grown ? 6 : 0,
            backgroundColor: KIND_COLOR[stat.kind],
            transition: animate
              ? `flex-grow ${CHART_GROW_MS}ms ${CHART_EASE}, min-width ${CHART_GROW_MS}ms ${CHART_EASE}`
              : undefined
          }}
        />
      ))}
    </div>
  );
};

/**
 * The legend, on the page's `label … value · %` rule. The character total and
 * the average sit on a second `text-xs` line rather than crowding the first —
 * the same relationship a stat card's hint has to its figure.
 */
const Legend: React.FC<{ app: HostApi; analysis: ParagraphAnalysis }> = ({ app, analysis }) => (
  <ul className="pnsv-pa-legend">
    {analysis.kinds.map((stat) => (
      <li key={stat.kind} className="pnsv-pa-legend-row">
        <span className="pnsv-pa-legend-main">
          <span className="pnsv-pa-legend-head">
            <span className="pnsv-pa-dot" style={{ backgroundColor: KIND_COLOR[stat.kind] }} />
            <span className="pnsv-pa-legend-label">{kindLabel(app, stat.kind)}</span>
          </span>
          <span className="pnsv-pa-legend-value">
            {formatParagraphs(app, stat.paragraphs)} · {formatPercent(app, stat.share)}
          </span>
        </span>
        <span className="pnsv-pa-legend-hint">
          {formatChars(app, stat.chars)} · {tr(app, STR.avgShort)}{' '}
          {formatChars(app, stat.avgChars, true)}
        </span>
      </li>
    ))}
  </ul>
);

/**
 * The pane. Rendered full-bleed by the host, so it owns its own insets.
 *
 * It borrows the analytics page's *substance* — the stat-card type scale, the
 * chart palette, the stacked share bar and its legend, the grow-in easing — but
 * not its chrome. The page nests bordered cards inside tinted trays because it
 * has a full settings width to fill; repeated at 344px that becomes a box inside
 * a box inside a box, and the borders end up louder than the figures. So there
 * is no tray, the tiles carry a fill instead of a border, and the chart sits
 * directly on the pane.
 *
 * The two scope tabs are the reason this is a pane rather than a floating
 * widget: a chapter's dialogue ratio is a different question from the
 * manuscript's, and a writer checking pacing wants both.
 */
export const ParagraphAnalysisPane: React.FC<PaneViewProps> = ({ app, fileId }) => {
  const projectAvailable = (() => {
    try {
      return Boolean(app.project?.available);
    } catch {
      return false;
    }
  })();

  const [scope, setScope] = React.useState<Scope>(() => {
    const stored = app.storage.get<Scope>(KEYS.scope);
    return stored === 'project' && projectAvailable ? 'project' : 'file';
  });

  const chooseScope = (next: Scope) => {
    setScope(next);
    app.storage.set(KEYS.scope, next);
  };

  const { analysis, unavailable } = useAnalysis(app, scope, fileId);
  const empty = !analysis || analysis.counted === 0;

  return (
    <div className="pnsv-pa-root">
      {projectAvailable ? <ScopeTabs app={app} value={scope} onChange={chooseScope} /> : null}

      {unavailable || empty ? (
        <div className="pnsv-pa-body">
          <p className="pnsv-pa-empty">
            {tr(app, unavailable ? STR.projectUnavailable : STR.emptyState)}
          </p>
        </div>
      ) : (
        // The tab rule runs edge to edge, so the insets belong to the content
        // under it rather than to the pane.
        <div className="pnsv-pa-body">
          <div className="pnsv-pa-grid">
            <Stat
              label={tr(app, STR.totalChars)}
              value={analysis.chars}
              format={(value) => formatChars(app, value)}
            />
            <Stat
              label={tr(app, STR.avgParagraph)}
              value={analysis.avgChars}
              format={(value) => formatChars(app, value, true)}
            />
            <Stat
              label={tr(app, STR.totalParagraphs)}
              value={analysis.units}
              format={(value) => formatItems(app, value)}
              hint={`${tr(app, STR.emptyParagraphs)} ${formatItems(app, analysis.empty)}`}
            />
            <Stat
              label={tr(app, STR.mobileEstimate)}
              value={analysis.mobileLines}
              format={(value) => formatDecimal(app, value)}
              hint={tr(app, STR.linesPerParagraph)}
            />
          </div>

          <div className="pnsv-pa-chart">
            <ShareBar app={app} analysis={analysis} />
            <Legend app={app} analysis={analysis} />
          </div>
        </div>
      )}
    </div>
  );
};

/** Kind order is fixed by the engine; re-exported so the analytics card matches the pane. */
export { PARAGRAPH_KINDS };
