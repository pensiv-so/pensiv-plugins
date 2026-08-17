import { resolveLocalizedText, type HostApi, type LocalizedText } from '@pensiv/plugin-sdk';

/** Shorthand for a three-language {@link LocalizedText} literal. */
export const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });

/** Resolve a {@link LocalizedText} in the live UI language. */
export const tr = (app: HostApi, text: LocalizedText): string =>
  resolveLocalizedText(text, app.app.locale);

/**
 * Runtime UI strings. Kept in one place so the card, the chip and the phone
 * sheet can never drift apart — the same reason the app keeps a `*.json` locale
 * namespace per feature.
 */
export const STR = {
  title: L('Writing Time', '집필 시간', '執筆時間'),
  status: L('Status', '상태', 'ステータス'),
  writingNow: L('Writing now', '집필 중', '執筆中'),
  idle: L('Idle', '대기 중', '待機中'),
  wordsToday: L('Words today', '오늘 단어', '今日の単語'),
  charsToday: L('Chars today', '오늘 글자', '今日の文字'),
  dailyGoal: L('Daily goal', '일일 목표', '1日の目標'),
  target: L('Daily time goal', '일일 시간 목표', '1日の時間目標'),
  targetDesc: L(
    'Minutes of active writing to aim for each day. Set 0 to hide the progress bar.',
    '하루에 목표로 할 집필 시간(분). 0으로 두면 진행률 막대를 숨깁니다.',
    '1日に目標とする執筆時間（分）。0にすると進捗バーを非表示にします。'
  ),
  settings: L('Writing time settings', '집필 시간 설정', '執筆時間の設定'),
  showFloating: L('Show floating widget', '플로팅 위젯 표시', 'フローティングウィジェットを表示'),
  showFloatingDesc: L(
    'Pin a live timer card to a screen corner.',
    '실시간 타이머 카드를 화면 모서리에 고정합니다.',
    'ライブタイマーカードを画面の隅に固定します。'
  ),
  summaryCommand: L(
    "Writing Time: Today's summary",
    '집필 시간: 오늘 요약',
    '執筆時間: 今日のまとめ'
  ),
  analyticsTitle: L('Writing time', '집필 시간', '執筆時間'),
  analyticsTotal: L('Total', '합계', '合計'),
  analyticsAverage: L('Per writing day', '집필한 날 평균', '執筆日あたり'),
  analyticsBest: L('Best day', '최고 기록', '最高記録'),
  analyticsLoading: L('Loading…', '불러오는 중...', '読み込み中...'),
  analyticsEmpty: L('No writing time recorded yet.', '아직 기록된 집필 시간이 없습니다.', 'まだ記録された執筆時間はありません。'),
  analyticsUnavailable: L(
    "Writing history isn't available right now.",
    '집필 기록을 불러올 수 없습니다.',
    '執筆履歴を読み込めませんでした。'
  ),
  analyticsDaily: L('Daily record', '일별 기록', '日別の記録'),
  rhythmTitle: L('Writing rhythm', '집필 리듬', '執筆リズム'),
  rhythmShare: L('Days written', '집필한 날 비율', '執筆した日の割合'),
  rhythmLongestRun: L('Longest run', '최장 연속', '最長連続'),
  rhythmLongestGap: L('Longest break', '최장 공백', '最長ブランク'),
  rhythmWrote: L('Wrote', '집필', '執筆'),
  rhythmRested: L('Rested', '휴식', '休み'),
  daysUnit: L('d', '일', '日'),
  ofDays: L('of {{total}} days', '{{total}}일 중', '{{total}}日中')
} as const;

/**
 * `1h 24m` / `1시간 24분` / `1時間24分`. The unit suffix is part of the string in
 * CJK, so formatting has to be locale-aware rather than a template with a
 * translated label bolted on.
 */
export const formatDuration = (app: HostApi, ms: number): string => {
  const totalSeconds = Math.round(Math.max(0, ms) / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const base = (app.app.locale || 'en').split('-')[0];

  // Under a minute, keep seconds. Flooring to minutes here printed "0분" for a
  // 40-second average, which reads as "you wrote nothing" rather than "briefly".
  if (totalSeconds < 60) {
    if (base === 'ko') return `${totalSeconds}초`;
    if (base === 'ja') return `${totalSeconds}秒`;
    return `${totalSeconds}s`;
  }

  // A whole number of hours drops the minutes entirely — a goal of 60 minutes
  // should read "1시간", not "1시간 0분".
  if (base === 'ko') {
    if (hours === 0) return `${minutes}분`;
    return minutes === 0 ? `${hours}시간` : `${hours}시간 ${minutes}분`;
  }
  if (base === 'ja') {
    if (hours === 0) return `${minutes}分`;
    return minutes === 0 ? `${hours}時間` : `${hours}時間${minutes}分`;
  }
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
};
