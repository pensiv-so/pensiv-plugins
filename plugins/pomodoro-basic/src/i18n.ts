import { resolveLocalizedText, type HostApi, type LocalizedText } from '@pensiv/plugin-sdk';

/** Shorthand for a three-language {@link LocalizedText} literal (see the Timer plugin). */
export const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });

/** Resolve a {@link LocalizedText} in the live UI language. */
export const tr = (app: HostApi, text: LocalizedText): string =>
  resolveLocalizedText(text, app.app.locale);

/**
 * Strings the plugin renders itself. Schema labels are {@link LocalizedText} too,
 * but the host resolves those; everything a component prints goes through
 * {@link tr} against `app.app.locale`.
 */
export const STR = {
  pomodoro: L('Pomodoro', '뽀모도로', 'ポモドーロ'),

  // Phase badge
  focus: L('Focus', '집중', '集中'),
  shortBreak: L('Short break', '짧은 휴식', '小休憩'),
  longBreak: L('Long break', '긴 휴식', '長い休憩'),
  paused: L('Paused', '일시정지', '一時停止'),
  ready: L('Ready', '준비', '準備'),

  // Transport
  start: L('Start', '시작', '始める'),
  pause: L('Pause', '일시정지', '一時停止'),
  resume: L('Resume', '재개', '再開する'),
  startNext: L('Start next', '다음 시작', '次を開始'),
  skip: L('Skip', '건너뛰기', 'スキップ'),
  reset: L('Reset', '초기화', 'リセット'),
  settings: L('Settings', '설정', '設定'),

  // Sheet rows
  cycle: L('Cycle', '사이클', 'サイクル'),
  next: L('Next', '다음', '次'),
  holdToReset: L('Hold to reset', '길게 눌러 초기화', '長押しでリセット'),

  // Notifications
  focusDone: L('Focus session complete', '집중 세션 완료', '集中セッション完了'),
  breakDone: L('Break over', '휴식 종료', '休憩終了'),
  timeToBreak: L('Time for a break.', '휴식할 시간입니다.', '休憩の時間です。'),
  timeToFocus: L('Back to writing.', '다시 집필할 시간입니다.', '執筆に戻りましょう。')
} as const;
