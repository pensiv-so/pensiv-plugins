import { Plugin } from '@pensiv/plugin-sdk';
import './styles.css';
import { settingsSchema } from './settings';
import { calculatorStore } from './store';
import { CalculatorPane, CalculatorPaneActions } from './pane';
import { CalculatorChip, CalculatorFloatingWidget } from './widget';
import { CalculatorSheet } from './sheet';
import { L, STR, tr } from './i18n';

/**
 * Calculator — arithmetic where the writing is, not in another window.
 *
 * Three surfaces, one {@link calculatorStore}, so a sum survives moving between
 * them:
 *   - a **side pane** (`registerPaneView`), whose toggle the host puts in the
 *     header of *every* file type. This is the primary surface: a dialog would
 *     cover the manuscript you are doing the arithmetic *about*, and closes the
 *     moment you touch the text again;
 *   - a **floating widget** (`registerWidget`, off until the user turns it on),
 *     with a phone tray **chip** and **bottom sheet** from the same registration;
 *   - a command that toggles the floating widget from the palette.
 *
 * The pane view deliberately carries no `fileTypes` filter: `SurfaceScope` is
 * omit-to-allow, so the toggle appears in documents, sheets, plotboards,
 * canvases, folder views and tasks alike — and in whatever file type pensiv adds
 * next, with no republish. A calculator is not about the file it opens from.
 */
export default class CalculatorPlugin extends Plugin {
  onload(): void {
    this.addSettingTab({ title: tr(this.app, STR.calculator), schema: settingsSchema });

    this.registerPaneView({
      id: 'calculator',
      title: tr(this.app, STR.calculator),
      icon: 'Calculator',
      render: CalculatorPane,
      // Options at the right end of the pane's header row, where the built-in
      // panes put theirs.
      headerActions: CalculatorPaneActions
    });

    this.registerWidget({
      id: 'calculator',
      surface: 'floating',
      frame: 'floating',
      defaultCorner: 'bottom-right',
      storageKey: 'pensiv:plugin:calculator:corner',
      shouldRender: ({ app }) => app.storage.get<boolean>('showFloatingWidget') ?? false,
      // The phone tray chip is its own surface, offered by default and managed
      // from the pane "Widgets" sheet — independent of the floating-widget
      // toggle, which is a desktop/tablet setting.
      chipShouldRender: ({ app }) => app.storage.get<boolean>('showChip') !== false,
      // Ring the pill while something is held in memory: it is the only
      // calculator state that outlives a glance at the chip.
      chipAccent: () => calculatorStore.state.memorySet,
      component: CalculatorFloatingWidget,
      chip: CalculatorChip,
      sheet: CalculatorSheet
    });

    this.addCommand({
      id: 'toggle-widget',
      name: L(
        'Calculator: Toggle floating widget',
        '계산기: 플로팅 위젯 표시/숨기기',
        '電卓: フローティングウィジェットの表示切り替え'
      ),
      // The palette can't open a side pane (that is the header toggle's job), so
      // the command drives the surface it *can* control — and writing the setting
      // is what the settings form reads, so the two never disagree.
      run: () => {
        const next = !(this.app.storage.get<boolean>('showFloatingWidget') ?? false);
        this.app.storage.set('showFloatingWidget', next);
        this.app.ui.toast(tr(this.app, next ? STR.widgetShown : STR.widgetHidden));
      }
    });
  }
}
