import { resolveLocalizedText, type HostApi, type LocalizedText } from '@pensiv/plugin-sdk';

/** Shorthand for a three-language {@link LocalizedText} literal. */
export const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });

/**
 * Runtime UI strings, mirrored from the app's `timer.json` locale files so the
 * plugin reads identically to the native Timer in every language. Schema labels
 * use {@link LocalizedText} too (resolved by the host); these are the strings the
 * plugin renders itself.
 */
export const STR = {
  start: L('Start', '시작', '始める'),
  pause: L('Pause', '일시정지', '一時停止'),
  resume: L('Resume', '재개', '再開する'),
  cancel: L('Cancel', '취소', 'キャンセル'),
  restart: L('Restart', '다시 시작', '再起動'),
  stop: L('Stop', '중지', '停止'),
  settings: L('Settings', '설정', '設定'),
  timer: L('Timer', '타이머', 'タイマー'),
  stopwatch: L('Stopwatch', '스톱워치', 'ストップウォッチ'),
  switchToTimer: L('Switch to Timer', '타이머로 전환', 'タイマーに切り替える'),
  switchToStopwatch: L('Switch to Stopwatch', '스톱워치로 전환', 'ストップウォッチに切り替える')
} as const;

/** `{minutes}m` preset label, localized (`분` in Korean). */
export const presetLabel = (app: HostApi, minutes: number): string => {
  const base = (app.app.locale || 'en').split('-')[0];
  if (base === 'ko') return `${minutes}분`;
  return `${minutes}m`;
};

/** Resolve a {@link LocalizedText} in the live UI language. */
export const tr = (app: HostApi, text: LocalizedText): string =>
  resolveLocalizedText(text, app.app.locale);
