import { Plugin } from '@pensiv/plugin-sdk';
import './styles.css';
import { readSettings, settingsSchema } from './settings';
import { pomodoroStore } from './store';
import { PomodoroHeaderButton } from './header';
import { PomodoroFloatingWidget, PomodoroChip } from './widget';
import { PomodoroSheet } from './sheet';
import { L, STR, tr } from './i18n';

/**
 * Pomodoro Basic — focus/break cycles, one dial, nothing else. No history, no
 * stats pane: the plugin's whole job is the phase you are in and the time left.
 *
 * One {@link pomodoroStore} singleton drives every surface:
 *   - the **app-header button** + popover (`registerAppHeaderAction({ render })`),
 *   - the **floating widget** (`registerWidget`, gated by `showFloatingWidget`),
 *     with a phone tray **chip** and **bottom sheet** from the same registration,
 *   - commands for start/pause, skip and reset,
 * plus a declarative settings tab: three phase colours, four durations, and the
 * auto-start / chime toggles.
 *
 * Host side-effects that must fire once for the whole plugin (the chime, the
 * notification) are wired here against the plugin lifecycle — never inside a
 * component, which would fire once per mounted surface.
 */
export default class PomodoroBasicPlugin extends Plugin {
  onload(): void {
    // Seed the run-state store from durable settings before any surface mounts,
    // so the header shows the configured duration on first paint.
    const initial = readSettings((key) => this.app.storage.get(key));
    pomodoroStore.setDurations({
      focus: initial.focus,
      shortBreak: initial.shortBreak,
      longBreak: initial.longBreak,
      cycleLength: initial.cycleLength
    });
    pomodoroStore.setAutoStart(initial.autoStartBreaks, initial.autoStartFocus);

    // A finished phase chimes and notifies — once, not once per surface.
    pomodoroStore.onPhaseComplete = (phase) => {
      const settings = readSettings((key) => this.app.storage.get(key));
      if (settings.playSound) this.app.platform.playSound('Ping');
      if (settings.notify) {
        try {
          this.app.platform.notify(
            tr(this.app, phase === 'focus' ? STR.focusDone : STR.breakDone),
            tr(this.app, phase === 'focus' ? STR.timeToBreak : STR.timeToFocus)
          );
        } catch {
          // The notifications grant can be declined; the chime and the UI still fire.
        }
      }
    };
    this.register(() => {
      pomodoroStore.onPhaseComplete = null;
    });

    this.addSettingTab({ title: tr(this.app, STR.pomodoro), schema: settingsSchema });

    this.registerAppHeaderAction({
      id: 'pomodoro',
      label: 'Pomodoro',
      icon: 'Clock',
      render: PomodoroHeaderButton
    });

    this.registerWidget({
      id: 'pomodoro',
      surface: 'floating',
      frame: 'floating',
      defaultCorner: 'bottom-right',
      storageKey: 'pensiv:plugin:pomodoro:corner',
      shouldRender: ({ app }) => app.storage.get<boolean>('showFloatingWidget') ?? false,
      // The phone tray chip is a separate surface from the desktop/tablet
      // floating card: it is offered by default and hidden from the pane
      // "Widgets" manage sheet, independent of the floating-widget setting.
      chipShouldRender: ({ app }) => app.storage.get<boolean>('showChip') !== false,
      // Accent the pill while a phase is actually counting.
      chipAccent: () => pomodoroStore.state === 'running',
      component: PomodoroFloatingWidget,
      chip: PomodoroChip,
      sheet: PomodoroSheet
    });

    this.addCommand({
      id: 'toggle',
      name: L(
        'Pomodoro: Start / pause',
        '뽀모도로: 시작 / 일시정지',
        'ポモドーロ: 開始 / 一時停止'
      ),
      run: () => pomodoroStore.toggle()
    });

    this.addCommand({
      id: 'skip',
      name: L('Pomodoro: Skip phase', '뽀모도로: 단계 건너뛰기', 'ポモドーロ: フェーズをスキップ'),
      run: () => pomodoroStore.skip()
    });

    this.addCommand({
      id: 'reset-cycle',
      name: L('Pomodoro: Reset cycle', '뽀모도로: 사이클 초기화', 'ポモドーロ: サイクルをリセット'),
      run: () => pomodoroStore.resetCycle()
    });
  }

  onunload(): void {
    // Stop the countdown when the plugin is disabled — the store is a module
    // singleton and would otherwise keep ticking unattended.
    pomodoroStore.reset();
  }
}
