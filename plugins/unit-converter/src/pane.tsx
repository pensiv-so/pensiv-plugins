import * as React from 'react';
import type { PaneViewProps } from '@pensiv/plugin-sdk';
import { ConverterPanel } from './panel';
import { CategoryPicker } from './category';
import { Icon, Settings } from './icons';
import { STR, tr } from './i18n';

/**
 * The side-pane view — the plugin's primary surface, registered with
 * `registerPaneView` so the host puts a toggle in **every** file header and docks
 * the converter beside the editor.
 *
 * A side pane rather than a dialog on purpose: converting a distance is
 * something you do *mid-sentence*, and a modal hides the sentence. Docked, the
 * result stays visible while you write the line it belongs in.
 *
 * Plugin panes are rendered full-bleed — the host draws the pane chrome (title,
 * close) but adds no padding — so the panel's `pane` variant owns its insets.
 */
export const ConverterPane: React.FC<PaneViewProps> = ({ app }) => (
  <ConverterPanel app={app} variant="pane" hideCategory />
);

/**
 * The pane's header controls, at the right end — the category dropdown and the
 * options, where the built-in panes put theirs (AI Review's dock toggle sits in
 * the same spot). The header row already exists, so the switch costs no vertical
 * space, never scrolls away, and leaves the body to the conversion.
 */
export const ConverterPaneActions: React.FC<PaneViewProps> = ({ app }) => (
  <>
    <CategoryPicker app={app} />
    <button
      type="button"
      className="pnsv-uc-btn pnsv-uc-btn-ghost pnsv-uc-btn-icon"
      aria-label={tr(app, STR.settings)}
      title={tr(app, STR.settings)}
      onClick={() => app.ui.openSettings()}
    >
      <Icon size="1rem">{Settings}</Icon>
    </button>
  </>
);
