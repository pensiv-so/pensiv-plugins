import { Plugin } from '@pensiv/plugin-sdk';
import './styles.css';
import { formatDate } from './engine';
import { readSettings, settingsSchema } from './settings';
import { today } from './store';
import { DatePane, DatePaneActions } from './pane';
import { DateChip, DateFloatingWidget } from './widget';
import { DateSheet } from './sheet';
import { L, STR, tr } from './i18n';

/**
 * Date Calculator — ages, spans and "what date is 40 days from here", for people
 * who keep a character's birthday and a story's timeline straight in their head.
 *
 * Three surfaces, one store, so the dates you typed survive moving between them:
 *   - a **side pane** (`registerPaneView`), whose toggle the host puts in the
 *     header of *every* file type. This is the primary surface: the dates belong
 *     next to the scene they describe, and a dialog would hide it;
 *   - a **floating widget** (`registerWidget`, off until the user turns it on),
 *     with a phone tray **chip** and **bottom sheet** from the same registration;
 *   - commands: toggle the widget, and type today's date at the cursor.
 *
 * The pane view carries no `fileTypes` filter on purpose: `SurfaceScope` is
 * omit-to-allow, so the toggle appears in documents, sheets, plotboards,
 * canvases, folder views and tasks alike — and in whatever file type pensiv adds
 * next, with no republish.
 */
export default class DateCalculatorPlugin extends Plugin {
  onload(): void {
    this.addSettingTab({ title: tr(this.app, STR.title), schema: settingsSchema });

    this.registerPaneView({
      id: 'date-calculator',
      title: tr(this.app, STR.title),
      icon: 'CalendarDays',
      render: DatePane,
      // Mode switch and options both ride at the right end of the pane's header
      // row, where the built-in panes put theirs. Three tabs across the body
      // spent its widest row on navigation.
      headerActions: DatePaneActions
    });

    this.registerWidget({
      id: 'date-calculator',
      surface: 'floating',
      frame: 'floating',
      defaultCorner: 'bottom-right',
      storageKey: 'pensiv:plugin:date-calculator:corner',
      shouldRender: ({ app }) => app.storage.get<boolean>('showFloatingWidget') ?? false,
      // The phone tray chip is its own surface, offered by default and managed
      // from the pane "Widgets" sheet — independent of the floating-widget
      // toggle, which is a desktop/tablet setting.
      chipShouldRender: ({ app }) => app.storage.get<boolean>('showChip') !== false,
      component: DateFloatingWidget,
      chip: DateChip,
      sheet: DateSheet
    });

    this.addCommand({
      id: 'toggle-widget',
      name: L(
        'Date Calculator: Toggle floating widget',
        '날짜 계산기: 플로팅 위젯 표시/숨기기',
        '日付計算: フローティングウィジェットの表示切り替え'
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

    this.addCommand({
      id: 'insert-today',
      name: L(
        "Date Calculator: Insert today's date",
        '날짜 계산기: 오늘 날짜 삽입',
        '日付計算: 今日の日付を挿入'
      ),
      run: () => {
        const text = formatDate(
          today(this.app),
          readSettings(this.app).dateFormat,
          this.app.app.locale ?? 'en'
        );
        try {
          this.app.editor.insert(text);
        } catch {
          // Fired from the palette with no editor focused — say what to do
          // rather than failing silently.
          this.app.ui.toast(tr(this.app, STR.insertFailed));
        }
      }
    });
  }
}
