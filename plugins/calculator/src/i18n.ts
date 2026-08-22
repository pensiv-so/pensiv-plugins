import { resolveLocalizedText, type HostApi, type LocalizedText } from '@pensiv/plugin-sdk';

/** Shorthand for a three-language {@link LocalizedText} literal (see the Timer plugin). */
export const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });

/** Resolve a {@link LocalizedText} in the live UI language. */
export const tr = (app: HostApi, text: LocalizedText): string =>
  resolveLocalizedText(text, app.app.locale);

/**
 * BCP-47 tag for `toLocaleString`. The host locale is `en` | `ko` | `ja`, which
 * are all valid tags on their own — this exists so the mapping is stated once.
 */
export const localeTag = (app: HostApi): string => app.app.locale ?? 'en';

/** Strings the plugin renders itself; schema labels are resolved by the host. */
export const STR = {
  calculator: L('Calculator', '계산기', '電卓'),

  // Keypad accessibility labels
  clear: L('Clear', '전체 지우기', 'すべてクリア'),
  clearEntry: L('Clear entry', '입력 지우기', '入力をクリア'),
  backspace: L('Backspace', '지우기', '一文字削除'),
  negate: L('Negate', '부호 바꾸기', '符号を反転'),
  percent: L('Percent', '퍼센트', 'パーセント'),
  add: L('Add', '더하기', '足す'),
  subtract: L('Subtract', '빼기', '引く'),
  multiply: L('Multiply', '곱하기', '掛ける'),
  divide: L('Divide', '나누기', '割る'),
  equals: L('Equals', '계산', '計算'),
  decimal: L('Decimal point', '소수점', '小数点'),

  // Memory
  memoryClear: L('Memory clear', '메모리 지우기', 'メモリクリア'),
  memoryRecall: L('Memory recall', '메모리 불러오기', 'メモリ呼び出し'),
  memoryAdd: L('Memory add', '메모리에 더하기', 'メモリに加算'),
  memorySubtract: L('Memory subtract', '메모리에서 빼기', 'メモリから減算'),
  memoryStore: L('Memory store', '메모리에 저장', 'メモリに保存'),

  // Actions
  copy: L('Copy result', '결과 복사', '結果をコピー'),
  copied: L('Result copied', '결과를 복사했습니다', '結果をコピーしました'),
  insert: L('Insert into text', '본문에 삽입', '本文に挿入'),
  inserted: L('Result inserted', '결과를 삽입했습니다', '結果を挿入しました'),
  insertFailed: L(
    'Open a document or sheet to insert the result',
    '결과를 삽입하려면 문서나 시트를 열어주세요',
    '結果を挿入するには文書かシートを開いてください'
  ),
  copyFailed: L('Could not copy', '복사하지 못했습니다', 'コピーできませんでした'),

  // Tape
  tape: L('History', '기록', '履歴'),
  tapeEmpty: L('No calculations yet', '아직 계산 기록이 없습니다', 'まだ計算履歴はありません'),
  clearTape: L('Clear history', '기록 지우기', '履歴を消去'),
  settings: L('Settings', '설정', '設定'),

  // Command feedback
  widgetShown: L(
    'Floating calculator shown',
    '플로팅 계산기를 표시했습니다',
    'フローティング電卓を表示しました'
  ),
  widgetHidden: L(
    'Floating calculator hidden',
    '플로팅 계산기를 숨겼습니다',
    'フローティング電卓を非表示にしました'
  )
} as const;
