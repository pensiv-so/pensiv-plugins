/**
 * Foreshadowing — plant a beat on a sentence, pay it off later, watch the rate.
 *
 * The reference example for **anchoring plugin data to prose**. Three pieces:
 *
 *  1. `registerEditorExtension(ForeshadowMark)` — the beat is a mark inside the
 *     document, so it moves with the text, syncs with it, and dies with it. No
 *     side table of offsets to keep in step (see `mark.ts`).
 *  2. `registerSurfaceItem` on `editor.selection` **and** `editor.menu` — the two
 *     entry points onto a selection. Both hand over `target.range`, snapshotted
 *     when the surface opened, which is what gets marked. Reading the live
 *     selection inside `onClick` would be too late: the menu takes focus and the
 *     toolbar tap can collapse it.
 *  3. `app.project.content()` + `app.ui.openFile(id, { range })` — read beats out
 *     of every file in the manuscript, then take the writer back to one.
 *
 * ## Beats are project-wide
 *
 * Foreshadowing is a debt the *manuscript* owes the reader, not a property of one
 * file. The document side pane opens on the project scope with the current file
 * as a narrowing tab (the notes pane's arrangement), and the plugin's settings
 * page carries the same list for when no document is open. No standalone
 * project tab — Eric cut it: two homes that both look native beat a third that
 * doesn't earn its page.
 */
import * as React from 'react';
import {
  Plugin,
  type EditorRange,
  type HostApi,
  type PaneViewProps,
  type SurfaceItemContext
} from '@pensiv/plugin-sdk';
import './styles.css';
import { ForeshadowMark, type ForeshadowAttrs } from './mark';
import { summarize, type Thread } from './anchors';
import { scanProject } from './scan';
import { ForeshadowList, PayoffPicker } from './list';
import { readSettings, SETTINGS_DEFAULTS } from './store';
import { createT, text } from './i18n';

/**
 * One icon for the whole plugin — tab, sidebar, side pane, toolbar, listing.
 * `Bookmark` reads as "this passage is marked and I'm coming back to it", which
 * is what a beat is; it is also unused by the document header's own items, so the
 * toggle can't be mistaken for a built-in pane.
 */
const ICON = 'Bookmark';
/** The document side pane view's id. */
const PANE_ID = 'threads';

/**
 * Ids are generated client-side and never reconciled with a server, so they only
 * have to be unique within a manuscript. `randomUUID` where it exists, a random
 * suffix elsewhere.
 */
function newId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ?? `fs-${Math.random().toString(36).slice(2)}-${performance.now().toString(36)}`;
}

export default class ForeshadowingPlugin extends Plugin {
  onload(): void {
    const t = createT(this.app);

    // ── the anchor layer ────────────────────────────────────────────────────
    // Document editor only (the default): a beat belongs to the manuscript.
    this.registerEditorExtension(ForeshadowMark);

    // ── planting: the one thing that starts from the prose ──────────────────
    const plant = (ctx: SurfaceItemContext) => {
      const range = ctx.target?.range;
      if (!range) {
        this.app.ui.toast(t('selectTextFirst'));
        return;
      }
      const id = newId();
      const attrs: ForeshadowAttrs = { fid: id, gid: id, kind: 'setup', label: '' };
      this.app.editor.runCommand('setForeshadowAnchor', attrs, range);
      this.app.ui.toast(t('planted'));
    };

    /** Anchor a payoff mark for `thread` over `range` in the active editor. */
    const payOff = (thread: Thread, range: EditorRange) => {
      this.app.editor.runCommand(
        'setForeshadowAnchor',
        {
          fid: newId(),
          gid: thread.gid,
          kind: 'payoff',
          label: thread.setup.label
        } satisfies ForeshadowAttrs,
        range
      );
      this.app.ui.toast(t('paidOff'));
    };

    /**
     * Paying off from the editor: the selection answers "which sentence", and a
     * host sheet asks "which beat" — the two halves of the gesture. The range is
     * `target.range` (snapshotted when the surface opened) and survives in the
     * closure while the sheet is up, so the dialog taking focus can't lose it.
     */
    const payOffFromEditor = (ctx: SurfaceItemContext) => {
      const range = ctx.target?.range;
      if (!range) {
        this.app.ui.toast(t('selectTextFirst'));
        return;
      }
      const { threads, titles } = scanProject(this.app);
      const open = threads.filter((thread) => !thread.resolved);
      if (open.length === 0) {
        this.app.ui.toast(t('emptyOpen'));
        return;
      }
      this.app.ui.openSheet(
        <PayoffPicker
          app={this.app}
          quote={ctx.target?.text ?? ''}
          threads={open}
          titles={titles}
          onPick={(thread) => {
            this.app.ui.closeSheet();
            payOff(thread, range);
          }}
        />,
        { title: t('payOff') }
      );
    };

    // The two actions on a selection: plant a beat, or pay one off.
    for (const surface of ['editor.selection', 'editor.menu'] as const) {
      this.registerSurfaceItem({
        surface,
        id: 'plant',
        label: t('plant'),
        icon: ICON,
        // Nothing selected ⇒ nothing to anchor to. The host omits `range` for an
        // empty selection, so this is the whole check.
        when: (ctx) => !!ctx.target?.range,
        onClick: plant
      });
      this.registerSurfaceItem({
        surface,
        id: 'payoff',
        label: t('payOff'),
        icon: 'Check',
        when: (ctx) => !!ctx.target?.range,
        onClick: payOffFromEditor
      });
    }

    // ── the list, beside the prose ──────────────────────────────────────────
    // Opens on the project scope (the debt is manuscript-wide); the current
    // file is a narrowing tab, not the default.
    const SidePane: React.FC<PaneViewProps> = ({ app, fileId }) => (
      <ForeshadowList app={app} fileId={fileId} variant="pane" />
    );

    this.registerPaneView({
      id: PANE_ID,
      title: t('paneTitle'),
      icon: ICON,
      // Beats are anchored in prose, so the side pane belongs to the two file
      // types that hold prose rather than to every pane the app has.
      fileTypes: ['document', 'sheet'],
      viewModes: ['file'],
      render: SidePane
    });

    // ── settings: the same list, plus the preferences ───────────────────────
    // Two tabs on purpose: the host renders `render` *instead of* `schema`, and
    // the preferences are better off as a host-drawn form than as markup of ours.
    const SettingsList: React.FC<{ app: HostApi }> = ({ app }) => (
      <ForeshadowList app={app} variant="settings" />
    );

    this.addSettingTab({ id: 'threads', title: t('paneTitle'), render: SettingsList });

    this.addSettingTab({
      id: 'preferences',
      title: t('preferences'),
      schema: {
        fields: [
          {
            key: 'highlightOpen',
            type: 'toggle',
            label: text.settingsHighlight,
            description: text.settingsHighlightHint,
            default: SETTINGS_DEFAULTS.highlightOpen
          },
          {
            key: 'strikeResolved',
            type: 'toggle',
            label: text.settingsStrike,
            description: text.settingsStrikeHint,
            default: SETTINGS_DEFAULTS.strikeResolved
          },
          {
            key: 'includeSheets',
            type: 'toggle',
            label: text.settingsIncludeSheets,
            description: text.settingsIncludeSheetsHint,
            default: SETTINGS_DEFAULTS.includeSheets
          }
        ]
      }
    });

    // ── the number, where the writer already looks at numbers ───────────────
    this.registerAnalyticsSection({
      id: 'payoff-rate',
      description: t('sectionDescription'),
      width: 'half',
      data: () => {
        const { threads, titles } = scanProject(this.app);
        const stats = summarize(threads);
        if (stats.total === 0) return { empty: t('empty') };

        // Which files are still carrying unpaid beats — the actionable half of
        // the number, and the reason this isn't just one percentage.
        const openByFile = new Map<string, number>();
        for (const thread of threads) {
          if (thread.resolved) continue;
          const key = thread.setup.fileId;
          openByFile.set(key, (openByFile.get(key) ?? 0) + 1);
        }
        const worst = Math.max(1, ...openByFile.values());

        return {
          stats: [
            { label: t('rate'), value: `${Math.round(stats.rate * 100)}%` },
            { label: t('statPlanted'), value: String(stats.total) },
            { label: t('statResolved'), value: String(stats.resolved) },
            { label: t('statOpen'), value: String(stats.open) }
          ],
          rows: [...openByFile.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([fileId, count]) => ({
              key: fileId,
              label: titles.get(fileId) ?? '—',
              value: String(count),
              fraction: count / worst
            })),
          note: t('noteScope')
        };
      }
    });

    // The highlight is CSS, so the preference is a class on the document element
    // rather than a re-render: the marks are already in the text.
    const applyHighlightPreference = () => {
      const root = globalThis.document?.documentElement;
      if (!root) return;
      root.classList.toggle('pnsv-fs-quiet', !readSettings(this.app).highlightOpen);
    };
    applyHighlightPreference();
    this.register(this.app.storage.on('highlightOpen', applyHighlightPreference));
    this.register(() => globalThis.document?.documentElement?.classList.remove('pnsv-fs-quiet'));
  }
}
