import { Plugin } from '@pensiv/plugin-sdk';
import './styles.css';
import { settingsSchema } from './settings';
import { ConverterPane, ConverterPaneActions } from './pane';
import { ConverterChip, ConverterFloatingWidget } from './widget';
import { ConverterSheet } from './sheet';
import { L, STR, tr } from './i18n';

/**
 * Unit Converter — metric, imperial, and the old East Asian units a period novel
 * is actually written in (尺 / 里 / 坪 / 斤 / 되).
 *
 * Three surfaces, one store, so the pair of units you picked survives moving
 * between them:
 *   - a **side pane** (`registerPaneView`), whose toggle the host puts in the
 *     header of *every* file type. This is the primary surface: you convert a
 *     distance mid-sentence, and a dialog would hide the sentence;
 *   - a **floating widget** (`registerWidget`, off until the user turns it on),
 *     with a phone tray **chip** and **bottom sheet** from the same registration;
 *   - a command that toggles the floating widget from the palette.
 *
 * The pane view carries no `fileTypes` filter on purpose: `SurfaceScope` is
 * omit-to-allow, so the toggle appears in documents, sheets, plotboards,
 * canvases, folder views and tasks alike — and in whatever file type pensiv adds
 * next, with no republish. How far a 里 is has nothing to do with which file you
 * happen to have open.
 */
export default class UnitConverterPlugin extends Plugin {
  onload(): void {
    this.addSettingTab({ title: tr(this.app, STR.title), schema: settingsSchema });

    this.registerPaneView({
      id: 'unit-converter',
      title: tr(this.app, STR.title),
      icon: 'Ruler',
      render: ConverterPane,
      // Category switch and options both ride at the right end of the pane's
      // header row, where the built-in panes put theirs. Seven categories as a
      // tab strip spent the widest line of a narrow pane on navigation.
      headerActions: ConverterPaneActions
    });

    this.registerWidget({
      id: 'unit-converter',
      surface: 'floating',
      frame: 'floating',
      defaultCorner: 'bottom-right',
      storageKey: 'pensiv:plugin:unit-converter:corner',
      shouldRender: ({ app }) => app.storage.get<boolean>('showFloatingWidget') ?? false,
      // The phone tray chip is its own surface, offered by default and managed
      // from the pane "Widgets" sheet — independent of the floating-widget
      // toggle, which is a desktop/tablet setting.
      chipShouldRender: ({ app }) => app.storage.get<boolean>('showChip') !== false,
      component: ConverterFloatingWidget,
      chip: ConverterChip,
      sheet: ConverterSheet
    });

    this.addCommand({
      id: 'toggle-widget',
      name: L(
        'Unit Converter: Toggle floating widget',
        '단위 변환: 플로팅 위젯 표시/숨기기',
        '単位変換: フローティングウィジェットの表示切り替え'
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
