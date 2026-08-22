import * as React from 'react';
import type { PaneViewProps } from '@pensiv/plugin-sdk';
import { DatePanel } from './panel';
import { ModePicker } from './picker';
import { Icon, Settings } from './icons';
import { STR, tr } from './i18n';

/**
 * The side-pane view — the plugin's primary surface, registered with
 * `registerPaneView` so the host puts a toggle in **every** file header and docks
 * the calculator beside the editor.
 *
 * A side pane rather than a dialog on purpose: you work out a character's age
 * *against* the scene you are writing, and a modal hides the scene. Docked, the
 * dates stay on screen while you type, which is the whole point of having them.
 *
 * Plugin panes are rendered full-bleed — the host draws the pane chrome (title,
 * close) but adds no padding — so the panel's `pane` variant owns its insets.
 */
export const DatePane: React.FC<PaneViewProps> = ({ app }) => (
  <DatePanel app={app} variant="pane" hideMode />
);

/**
 * The pane's header controls, at the right end — the mode dropdown and the
 * options, where the built-in panes put theirs (AI Review's dock toggle sits in
 * the same spot). Not a tab strip in the body: three tabs across the top of a
 * narrow pane spent its widest row on navigation and scrolled away with it.
 */
export const DatePaneActions: React.FC<PaneViewProps> = ({ app }) => (
  <>
    <ModePicker app={app} />
    <button
      type="button"
      className="pnsv-dc-btn pnsv-dc-btn-ghost pnsv-dc-btn-icon"
      aria-label={tr(app, STR.settings)}
      title={tr(app, STR.settings)}
      onClick={() => app.ui.openSettings()}
    >
      <Icon size="1rem">{Settings}</Icon>
    </button>
  </>
);
