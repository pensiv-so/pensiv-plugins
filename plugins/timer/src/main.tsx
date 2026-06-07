import { Plugin } from '@pensiv/plugin-sdk';
import './styles.css';
import { settingsSchema } from './settings';
import { timerStore } from './store';
import { TimerHeaderButton } from './header';
import { TimerFloatingWidget, TimerChip } from './widget';
import { TimerSheet } from './sheet';
import { L, tr, STR } from './i18n';

/**
 * Timer — a full, install-first replacement for the native writing timer.
 *
 * It contributes the same three surfaces, all sharing one {@link timerStore}:
 *   - the **app-header button** + popover (`registerAppHeaderAction({ render })`),
 *   - the **floating widget** (`registerWidget`, gated by `showFloatingWidget`),
 *   - a command to start / pause from the palette,
 * plus a settings tab that mirrors the native Timer settings one-for-one.
 */
export default class TimerPlugin extends Plugin {
  onload(): void {
    // Completion chime, played once by the shared store (not per-surface).
    timerStore.onComplete = () => this.app.platform.playSound('Ping');
    this.register(() => {
      timerStore.onComplete = null;
    });

    this.addSettingTab({ title: tr(this.app, STR.timer), schema: settingsSchema });

    this.registerAppHeaderAction({
      id: 'timer',
      label: 'Timer',
      icon: 'Clock',
      render: TimerHeaderButton
    });

    this.registerWidget({
      id: 'timer',
      surface: 'floating',
      frame: 'floating',
      defaultCorner: 'bottom-right',
      storageKey: 'pensiv:plugin:timer:corner',
      shouldRender: ({ app }) => app.storage.get<boolean>('showFloatingWidget') ?? false,
      // Phone tray chip is a separate surface from the desktop/tablet floating
      // widget: gated by its own `showChip` flag (default *shown*, toggled from
      // the pane "Widgets" manage sheet), independent of the "show floating
      // widget" setting above.
      chipShouldRender: ({ app }) => app.storage.get<boolean>('showChip') !== false,
      component: TimerFloatingWidget,
      chip: TimerChip,
      sheet: TimerSheet
    });

    this.addCommand({
      id: 'toggle',
      name: L('Timer: Start / pause', '타이머: 시작 / 일시정지', 'タイマー: 開始 / 一時停止'),
      run: () => {
        const s = timerStore.timerState;
        if (s === 'running') {
          timerStore.setTimerState('paused');
        } else if (s === 'paused') {
          timerStore.setTimerState('running');
        } else {
          const mode = this.app.storage.get<'timer' | 'stopwatch'>('mode') ?? 'timer';
          if (mode === 'stopwatch') {
            timerStore.setRemainingSeconds(0);
          } else {
            timerStore.setRemainingSeconds(timerStore.selectedMinutes * 60);
          }
          timerStore.setTimerState('running', mode);
        }
      }
    });
  }
}
