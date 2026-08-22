import { resolveLocalizedText, type HostApi, type LocalizedText } from '@pensiv/plugin-sdk';

/** Shorthand for a three-language {@link LocalizedText} literal (see the Timer plugin). */
export const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });

/** Resolve a {@link LocalizedText} in the live UI language. */
export const tr = (app: HostApi, text: LocalizedText): string =>
  resolveLocalizedText(text, app.app.locale);

/** BCP-47 tag for `toLocaleString`. */
export const localeTag = (app: HostApi): string => app.app.locale ?? 'en';

/** Strings the plugin renders itself; schema labels are resolved by the host. */
export const STR = {
  title: L('Unit Converter', '단위 변환', '単位変換'),

  from: L('From', '변환 전', '変換元'),
  to: L('To', '변환 후', '変換先'),
  swap: L('Swap units', '단위 바꾸기', '単位を入れ替え'),
  category: L('Category', '분류', '分類'),
  historical: L('Old units', '옛 단위', '尺貫法'),
  quick: L('Common', '자주 쓰는 변환', 'よく使う変換'),

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
  enterValue: L('Enter a number', '숫자를 입력해 주세요', '数値を入力してください'),

  // Command feedback
  widgetShown: L(
    'Floating converter shown',
    '플로팅 변환기를 표시했습니다',
    'フローティング変換ツールを表示しました'
  ),
  widgetHidden: L(
    'Floating converter hidden',
    '플로팅 변환기를 숨겼습니다',
    'フローティング変換ツールを非表示にしました'
  )
} as const;
