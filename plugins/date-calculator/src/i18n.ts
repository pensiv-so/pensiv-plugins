import { resolveLocalizedText, type HostApi, type LocalizedText } from '@pensiv/plugin-sdk';

/** Shorthand for a three-language {@link LocalizedText} literal (see the Timer plugin). */
export const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });

/** Resolve a {@link LocalizedText} in the live UI language. */
export const tr = (app: HostApi, text: LocalizedText): string =>
  resolveLocalizedText(text, app.app.locale);

/** BCP-47 tag for `toLocaleDateString` / `toLocaleString`. */
export const localeTag = (app: HostApi): string => app.app.locale ?? 'en';

/**
 * The language subtag alone (`ko` for `ko-KR`).
 *
 * The Host API types `locale` as `en | ko | ja`, but what arrives is the app's
 * live i18n language, which can carry a region (`ko-KR`). `resolveLocalizedText`
 * already falls back to the base subtag, so *labels* looked right while every
 * `locale === 'ko'` branch here quietly took the English path — Korean labels
 * with "18 days" next to them. Compare against this, never the raw tag.
 */
export const baseLocale = (app: HostApi): string => {
  const tag = app.app.locale ?? 'en';
  return tag.split('-')[0] ?? tag;
};

/** A counted noun: English singular/plural, plus the Korean and Japanese counters. */
export interface CountUnit {
  en: readonly [string, string];
  ko: string;
  ja: string;
}

/**
 * Counted nouns, which none of the three languages handle the same way: English
 * pluralizes and spaces, Korean and Japanese attach the counter directly. One
 * helper keeps that out of the views.
 */
export const countLabel = (app: HostApi, count: number, unit: CountUnit): string => {
  const locale = baseLocale(app);
  if (locale === 'ko') return `${count}${unit.ko}`;
  if (locale === 'ja') return `${count}${unit.ja}`;
  return `${count} ${count === 1 ? unit.en[0] : unit.en[1]}`;
};

export const UNIT = {
  year: { en: ['year', 'years'], ko: '년', ja: '年' },
  month: { en: ['month', 'months'], ko: '개월', ja: 'か月' },
  week: { en: ['week', 'weeks'], ko: '주', ja: '週' },
  day: { en: ['day', 'days'], ko: '일', ja: '日' }
} as const satisfies Record<string, CountUnit>;

/** Age counters — `세` / `歳`, not the `년` / `年` used for a span of time. */
export const AGE_UNIT: CountUnit = { en: ['year', 'years'], ko: '세', ja: '歳' };

/** Weekday names, indexed 0 = Sunday, in the three UI languages. */
export const WEEKDAYS: LocalizedText[] = [
  L('Sunday', '일요일', '日曜日'),
  L('Monday', '월요일', '月曜日'),
  L('Tuesday', '화요일', '火曜日'),
  L('Wednesday', '수요일', '水曜日'),
  L('Thursday', '목요일', '木曜日'),
  L('Friday', '금요일', '金曜日'),
  L('Saturday', '토요일', '土曜日')
];

/** Strings the plugin renders itself; schema labels are resolved by the host. */
export const STR = {
  title: L('Date Calculator', '날짜 계산기', '日付計算'),

  // Modes
  age: L('Age', '나이', '年齢'),
  between: L('Between', '기간', '期間'),
  shift: L('Add / subtract', '날짜 더하기', '日付を加減'),

  // Fields
  birthDate: L('Date of birth', '생년월일', '生年月日'),
  asOf: L('As of', '기준일', '基準日'),
  startDate: L('From', '시작일', '開始日'),
  endDate: L('To', '종료일', '終了日'),
  baseDate: L('Base date', '기준 날짜', '基準日'),
  amount: L('Amount', '기간', '期間'),
  today: L('Today', '오늘', '今日'),
  swap: L('Swap dates', '날짜 바꾸기', '日付を入れ替え'),
  reset: L('Reset', '초기화', 'リセット'),
  pickDate: L('Pick a date', '날짜 선택', '日付を選択'),
  prevMonth: L('Previous month', '이전 달', '前の月'),
  nextMonth: L('Next month', '다음 달', '次の月'),
  year: L('Year', '연도', '年'),

  // Units
  days: L('Days', '일', '日'),
  weeks: L('Weeks', '주', '週'),
  months: L('Months', '개월', 'か月'),
  years: L('Years', '년', '年'),
  add: L('Add', '더하기', '加算'),
  subtract: L('Subtract', '빼기', '減算'),

  // Age results
  ageExact: L('Age', '만 나이', '満年齢'),
  koreanAge: L('Korean age', '한국식 나이', '韓国式年齢'),
  koreanAgeNote: L(
    'Counting age: 1 at birth, +1 every New Year — still how ages are spoken.',
    '세는 나이입니다. 태어나면 1살, 해가 바뀔 때마다 한 살씩 늘어납니다.',
    '数え年です。生まれた時が 1 歳で、年が明けるごとに 1 歳増えます。'
  ),
  daysLived: L('Days lived', '살아온 날', '生きた日数'),
  nextBirthday: L('Next birthday', '다음 생일', '次の誕生日'),
  bornOn: L('Born on a', '태어난 요일', '生まれた曜日'),
  birthdayToday: L('Happy birthday 🎂', '생일입니다 🎂', '誕生日です 🎂'),
  enterBirthDate: L(
    'Enter a date of birth',
    '생년월일을 입력해 주세요',
    '生年月日を入力してください'
  ),
  enterDate: L('Enter a date', '날짜를 입력해 주세요', '日付を入力してください'),
  unborn: L(
    'The reference date is before the birth date',
    '기준일이 생년월일보다 앞섭니다',
    '基準日が生年月日より前です'
  ),

  // Between results
  duration: L('Duration', '기간', '期間'),
  totalDays: L('Total days', '전체 일수', '合計日数'),
  inWeeks: L('In weeks', '주 단위', '週単位'),
  includeEnd: L('Count the end date', '종료일 포함', '終了日を含める'),
  reversed: L(
    'The end date is earlier than the start date',
    '종료일이 시작일보다 앞섭니다',
    '終了日が開始日より前です'
  ),
  ago: L('ago', '전', '前'),

  // Shift results
  result: L('Result', '결과', '結果'),
  weekday: L('Weekday', '요일', '曜日'),
  fromNow: L('From today', '오늘로부터', '今日から'),

  // Actions
  copy: L('Copy', '복사', 'コピー'),
  copied: L('Copied', '복사했습니다', 'コピーしました'),
  copyFailed: L('Could not copy', '복사하지 못했습니다', 'コピーできませんでした'),
  insert: L('Insert into text', '본문에 삽입', '本文に挿入'),
  inserted: L('Inserted', '삽입했습니다', '挿入しました'),
  insertFailed: L(
    'Open a document or sheet to insert',
    '삽입하려면 문서나 시트를 열어주세요',
    '挿入するには文書かシートを開いてください'
  ),
  settings: L('Settings', '설정', '設定'),

  // Command feedback
  widgetShown: L(
    'Floating date calculator shown',
    '플로팅 날짜 계산기를 표시했습니다',
    'フローティング日付計算を表示しました'
  ),
  widgetHidden: L(
    'Floating date calculator hidden',
    '플로팅 날짜 계산기를 숨겼습니다',
    'フローティング日付計算を非表示にしました'
  )
} as const;
