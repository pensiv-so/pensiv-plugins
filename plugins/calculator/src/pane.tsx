import * as React from 'react';
import type { PaneViewProps } from '@pensiv/plugin-sdk';
import { CalculatorPanel } from './panel';
import { Icon, Settings } from './icons';
import { STR, tr } from './i18n';

/**
 * The side-pane view — the plugin's primary surface, registered with
 * `registerPaneView` so the host puts a toggle in **every** file header and docks
 * the calculator beside the editor.
 *
 * A side pane rather than a dialog on purpose: arithmetic happens *while* you are
 * writing (word counts, ages, page budgets), and a modal takes the manuscript
 * away to give you a keypad. The pane leaves the text visible and the caret where
 * it was, which is also what makes "insert result" worth having.
 *
 * Plugin panes are rendered full-bleed — the host draws the pane chrome (title,
 * close) but adds no padding — so the panel's `pane` variant owns its insets.
 * The host already gives the pane a scroll area; this just fills it.
 */
export const CalculatorPane: React.FC<PaneViewProps> = ({ app }) => (
  <CalculatorPanel app={app} variant="pane" />
);

/**
 * The pane's options, at the right end of the header — where the built-in panes
 * put theirs (AI Review's dock toggle sits in the same spot).
 */
export const CalculatorPaneActions: React.FC<PaneViewProps> = ({ app }) => (
  <button
    type="button"
    className="pnsv-calc-btn pnsv-calc-btn-ghost pnsv-calc-btn-icon"
    aria-label={tr(app, STR.settings)}
    title={tr(app, STR.settings)}
    onClick={() => app.ui.openSettings()}
  >
    <Icon size="1rem">{Settings}</Icon>
  </button>
);
