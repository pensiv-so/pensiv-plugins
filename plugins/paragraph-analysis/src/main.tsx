import { Plugin, type AnalyticsColor, type HostApi } from '@pensiv/plugin-sdk';

import './styles.css';
import { analyzeDoc, analyzeDocs, type ParagraphAnalysis, type ParagraphKind } from './analyze';
import {
  formatChars,
  formatItems,
  formatKindDetail,
  formatLines,
  formatSummary,
  kindLabel,
  STR,
  tr
} from './i18n';
import { ParagraphAnalysisPane, type Scope } from './pane';
import { KEYS, readOptions, settingsSchema } from './settings';

const PANE_ID = 'paragraph-analysis';
const ICON = 'Pilcrow';

/** Same slots the pane paints its segments with, so the two cards read as one feature. */
const KIND_SLOT: Record<ParagraphKind, AnalyticsColor> = {
  narration: 1,
  dialogue: 2,
  monologue: 3,
  special: 4
};

/** Every prose file's ProseMirror doc, or `null` when the project can't be read. */
const projectDocs = (app: HostApi): unknown[] | null => {
  try {
    if (!app.project?.available) return null;
    return app.project
      .query({ type: ['document', 'sheet'] })
      .map((file) => app.project.content(file.id)?.doc)
      .filter((doc): doc is unknown => doc !== undefined);
  } catch {
    return null;
  }
};

/**
 * Where does a paragraph belong? The engine answers by the glyph the paragraph
 * opens with — see [`analyze.ts`](./analyze.ts), which holds the whole rule and
 * the reasoning behind the defaults.
 *
 * This file is the wiring: one side pane, one settings form, one command, one
 * analytics card, all reading the same engine so the four surfaces can never
 * report different numbers for the same manuscript.
 */
export default class ParagraphAnalysisPlugin extends Plugin {
  onload(): void {
    const t = (key: keyof typeof STR) => tr(this.app, STR[key]);

    // ── the pane, beside the prose ──────────────────────────────────────────
    this.registerPaneView({
      id: PANE_ID,
      title: t('paneTitle'),
      icon: ICON,
      // Paragraph shape is a property of prose, so the pane is offered on the
      // two file types that hold it — in the file view, not the folder listing.
      fileTypes: ['document', 'sheet'],
      viewModes: ['file'],
      render: ParagraphAnalysisPane
    });

    // ── the rules, as a host-drawn form ─────────────────────────────────────
    this.addSettingTab({ id: 'rules', title: t('paneTitle'), schema: settingsSchema() });

    // ── the same numbers, as text ───────────────────────────────────────────
    this.addCommand({
      id: 'copy-summary',
      name: t('copyCommand'),
      run: async () => {
        const analysis = this.currentAnalysis();
        if (!analysis || analysis.counted === 0) {
          this.app.ui.toast(t('emptyState'));
          return;
        }
        try {
          await this.app.platform.clipboard.writeText(formatSummary(this.app, analysis));
          this.app.ui.toast(t('copied'));
        } catch {
          this.app.ui.toast(t('copyFailed'));
        }
      }
    });

    // ── the ratio, where the writer already looks at numbers ────────────────
    this.registerAnalyticsSection({
      id: 'paragraph-mix',
      description: t('sectionDescription'),
      width: 'half',
      data: () => {
        const docs = projectDocs(this.app);
        if (!docs) return { empty: t('projectUnavailable') };

        const analysis = analyzeDocs(docs, readOptions(this.app));
        if (analysis.counted === 0) return { empty: t('sectionEmpty') };

        return {
          stats: [
            { label: t('totalChars'), value: formatChars(this.app, analysis.chars) },
            {
              label: t('avgParagraph'),
              value: formatChars(this.app, analysis.avgChars, true),
              hint: formatLines(this.app, analysis.mobileLines)
            },
            {
              label: t('totalParagraphs'),
              value: formatItems(this.app, analysis.units),
              hint: `${t('emptyParagraphs')} ${formatItems(this.app, analysis.empty)}`
            }
          ],
          rows: analysis.kinds.map((stat) => ({
            key: stat.kind,
            label: kindLabel(this.app, stat.kind),
            value: formatKindDetail(this.app, stat.paragraphs, stat.chars, stat.avgChars),
            color: KIND_SLOT[stat.kind],
            fraction: stat.share
          }))
        };
      }
    });
  }

  /** The analysis for whichever scope the pane is currently showing. */
  private currentAnalysis(): ParagraphAnalysis | null {
    const options = readOptions(this.app);
    const scope = this.app.storage.get<Scope>(KEYS.scope);

    if (scope === 'project') {
      const docs = projectDocs(this.app);
      return docs ? analyzeDocs(docs, options) : null;
    }

    try {
      const doc = this.app.editor.getDoc();
      return doc ? analyzeDoc(doc, options) : null;
    } catch {
      return null;
    }
  }
}
