/**
 * Status Window — character stat blocks for web novels.
 *
 * ## What this plugin is for
 *
 * Web novels in the game-fantasy, hunter, isekai and LitRPG lineages print a
 * character's numbers into the prose, every few chapters, for hundreds of
 * chapters. Doing that by hand costs three things: the formatting stays
 * consistent only by vigilance, the numbers have to be carried forward from the
 * last time by memory, and the growth line (`14 [F] → 16(+2)[F]`) has to be
 * assembled from two sheets that were never in the same place.
 *
 * Authors currently solve this with a spreadsheet in another window. The
 * complaint is never that the spreadsheet is hard to build — it is that
 * updating it means leaving the manuscript, and that it only ever knows the
 * *current* state, so "what were her stats in chapter 31?" has no answer. Being
 * inside the editor, and storing per-episode deltas rather than snapshots, is
 * the whole idea.
 *
 * ## Shape
 *
 * - `model.ts` / `format.ts` / `width.ts` — typed values and the conventions
 *   that render them, transcribed from real serials.
 * - `template.ts` / `context.ts` / `render.ts` — a mustache subset and the data
 *   it lays out.
 * - `presets.ts` — six lineages, each pre-filling its own attribute rows.
 * - `storage.ts` — per-episode deltas, folded to give any point in the book.
 * - `mark.ts` / `blocks.ts` — the live block, which is a mark over plain text.
 * - `pane.tsx` and friends — the side pane the writing happens in.
 */
import * as React from 'react';
import {
  Plugin,
  type HostApi,
  type PaneViewProps,
  type SurfaceItemContext
} from '@pensiv/plugin-sdk';
import './styles.css';
import { blockAtSelection, flattenBlocks, insertBlock, refreshBlocks } from './blocks';
import { createT, fill, text as strings } from './i18n';
import { StatusBlockMark } from './mark';
import { StatusWindowPane } from './pane';
import { SystemMessageSheet } from './system';
import { PresetEditor } from './preset-editor';
import { readSettings, settingsSchema } from './settings';
import { readCharacters } from './storage';

/**
 * One icon everywhere — pane toggle, slash item, marketplace tile. `Id` reads as
 * "a card of facts about someone", which is what a status window is, and it is
 * unused by the document header's own items, so the toggle can't be mistaken for
 * a built-in pane.
 */
const ICON = 'Id';
const PANE_ID = 'status-window';

export default class StatusWindowPlugin extends Plugin {
  onload(): void {
    const t = createT(this.app);

    // ── the live block's anchor ─────────────────────────────────────────────
    // Both prose surfaces: a status window belongs in a chapter, but writers
    // keep character sheets as `sheet` files and paste blocks there too. The
    // default is `['document']` only, so sheets have to be asked for.
    this.registerEditorExtension(StatusBlockMark, { surfaces: ['document', 'sheet'] });

    // ── the pane ────────────────────────────────────────────────────────────
    const SidePane: React.FC<PaneViewProps> = ({ app, fileId }) => (
      <StatusWindowPane app={app} fileId={fileId} variant="pane" />
    );

    this.registerPaneView({
      id: PANE_ID,
      title: t('paneTitle'),
      icon: ICON,
      // Status windows are anchored in prose, so the pane belongs to the two
      // file types that hold prose rather than to every pane the app has.
      fileTypes: ['document', 'sheet'],
      viewModes: ['file'],
      render: SidePane
    });

    // No `registerHeaderAction` alongside it. `registerPaneView` already puts a
    // toggle in the file header through the customizable-header system, so a
    // second registration with the same icon just gave the writer two identical
    // buttons — and the wrong one at that: `ui.openPane` opens a plugin *tab*
    // (`registerPane`), which this plugin doesn't contribute, so that button
    // could only ever produce an empty "plugin pane unavailable" tab.

    // ── inserting ───────────────────────────────────────────────────────────

    /** Insert for the most recently usable character, or send them to the pane. */
    const quickInsert = (app: HostApi): void => {
      const fileId = app.app.fileId;
      if (!fileId) {
        app.ui.toast(t('noEpisode'));
        return;
      }
      const settings = readSettings(app);
      const character = readCharacters(app)[0];
      if (!character) {
        // Just say so. `ui.openPane` is for a plugin *tab* (`registerPane`) and
        // would open an empty "pane unavailable" one; there is no API to open a
        // side pane view, and the writer already has its toggle in the header.
        app.ui.toast(t('noCharacters'));
        return;
      }
      app.ui.toast(
        insertBlock(app, settings, fileId, character.id) ? t('inserted') : t('cannotInsertHere')
      );
    };

    this.addCommand({
      id: 'insert',
      name: strings.insert,
      icon: ICON,
      run: () => quickInsert(this.app)
    });

    this.registerSlashItem({
      id: 'status',
      title: t('paneTitle'),
      icon: ICON,
      // Both prose surfaces, matching where the mark is registered.
      surfaces: ['document', 'sheet'],
      run: () => quickInsert(this.app)
    });

    this.registerSlashItem({
      id: 'system',
      title: t('systemMessage'),
      icon: 'MessageSquare',
      surfaces: ['document', 'sheet'],
      run: () => this.openSystemSheet()
    });

    // ── keeping blocks current ──────────────────────────────────────────────

    this.addCommand({
      id: 'refresh',
      name: strings.refreshBlocks,
      run: () => {
        const fileId = this.app.app.fileId;
        if (!fileId) {
          this.app.ui.toast(t('noEpisode'));
          return;
        }
        const count = refreshBlocks(this.app, readSettings(this.app), fileId);
        this.app.ui.toast(
          count > 0 ? fill(t('refreshed'), { n: count }) : t('nothingToRefresh')
        );
      }
    });

    /**
     * The escape hatch, and the reason live blocks are safe to turn on: one
     * command takes every block back to ordinary prose. Disabling the plugin
     * does the same thing implicitly (a dropped mark leaves its text), but a
     * writer handing the manuscript to an editor wants it explicit.
     */
    this.addCommand({
      id: 'flatten',
      name: strings.flatten,
      run: () => {
        this.app.ui.toast(flattenBlocks(this.app) ? t('flattened') : t('nothingToRefresh'));
      }
    });

    // ── editing a block from the prose ──────────────────────────────────────
    // Both entry points onto a selection: the floating toolbar (which exists on
    // phones and tablets) and the right-click menu (which doesn't).
    for (const surface of ['editor.selection', 'editor.menu'] as const) {
      this.registerSurfaceItem({
        surface,
        id: 'edit-block',
        label: t('editThisBlock'),
        icon: ICON,
        // Only inside a live block. `when` is re-evaluated every render and a
        // throw hides the item, so a doc the walker can't read fails closed.
        when: (ctx) => blockAtSelection(ctx.app) !== undefined,
        onClick: (ctx: SurfaceItemContext) => {
          const block = blockAtSelection(ctx.app);
          if (!block) return;
          ctx.app.ui.openSheet(
            <StatusWindowPane
              app={ctx.app}
              fileId={ctx.app.app.fileId}
              variant="sheet"
              initialCharacterId={block.cid}
            />,
            { title: t('paneTitle') }
          );
        }
      });
    }

    // ── settings ────────────────────────────────────────────────────────────
    // Two tabs on purpose: the host renders `render` *instead of* `schema`, and
    // the preferences are better off as a host-drawn form than as markup of
    // ours. The template editor isn't, because it needs its preview beside it.
    this.addSettingTab({ id: 'preferences', title: t('paneTitle'), schema: settingsSchema });
    this.addSettingTab({
      id: 'template',
      title: t('templateSettings'),
      render: ({ app }: { app: HostApi }) => <PresetEditor app={app} />
    });
  }

  private openSystemSheet(): void {
    this.app.ui.openSheet(
      <SystemMessageSheet app={this.app} onDone={() => this.app.ui.closeSheet()} />,
      { title: createT(this.app)('systemMessage') }
    );
  }
}
