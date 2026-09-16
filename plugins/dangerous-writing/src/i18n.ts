import { resolveLocalizedText, type HostApi, type LocalizedText } from '@pensiv/plugin-sdk';

/** Shorthand for a three-language {@link LocalizedText} literal. */
export const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });

/** Resolve a {@link LocalizedText} in the live UI language. */
export const tr = (app: HostApi, text: LocalizedText): string =>
  resolveLocalizedText(text, app.app.locale);

/** Base BCP-47 language (`en`, `ko`, `ja`) for prompt/locale selection. */
export const baseLang = (app: HostApi): string => (app.app.locale || 'en').split('-')[0] ?? 'en';

/** Fill `{name}` placeholders in a resolved string. */
export const fmt = (s: string, vars: Record<string, string>): string =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);

/**
 * Runtime UI strings. The launcher is a CONTRACT — one sentence stating the
 * dare, with the goal and fuse as inline editable tokens ({goal} / {fuse} are
 * replaced with token buttons at render time, so each language controls its own
 * word order). Results speak the same voice: the number talks, in a sentence.
 */
export const STR = {
  title: L('Dangerous Writing', '위험한 글쓰기', 'デンジャラス・ライティング'),
  settings: L('Settings', '설정', '設定'),
  start: L('Start writing', '글쓰기 시작', '書き始める'),
  stop: L('Stop', '중지', '停止'),
  done: L('Done', '완료', '完了'),
  writeAgain: L('Write again', '다시 쓰기', 'もう一度書く'),

  // The contract sentence (idle), per goal type.
  contractTime: L(
    'Write for {goal} without pausing longer than {fuse} — or everything burns.',
    '{goal} 동안 {fuse} 넘게 멈추지 않고 쓰세요 — 멈추면 전부 불탑니다.',
    '{goal}のあいだ、{fuse}以上止まらずに書いてください — 止まればすべて燃えます。'
  ),
  contractWords: L(
    'Write {goal} without pausing longer than {fuse} — or everything burns.',
    '{fuse} 넘게 멈추지 않고 {goal}를 채우세요 — 멈추면 전부 불탑니다.',
    '{fuse}以上止まらずに{goal}を書き切ってください — 止まればすべて燃えます。'
  ),
  // Token / menu value labels.
  nMinutes: L('{n} minutes', '{n}분', '{n}分'),
  nWords: L('{n} words', '{n}단어', '{n}語'),
  nSeconds: L('{n} seconds', '{n}초', '{n}秒'),

  // The contract while a session runs ({left} is the live countdown / words left).
  runTime: L(
    "Don't stop — {left} until your words are safe.",
    '멈추지 마세요 — 글이 안전해지기까지 {left}.',
    '止まらないで — 安全まであと{left}。'
  ),
  runWords: L(
    "Don't stop — {left} to go.",
    '멈추지 마세요 — {left} 남았습니다.',
    '止まらないで — 残り{left}。'
  ),

  // Live pill status.
  keepTyping: L('Keep typing!', '계속 입력하세요!', '入力し続けて！'),
  dontStop: L("Don't stop…", '멈추지 마세요…', '止まらないで…'),
  aboutToLose: L('About to lose everything!', '모든 것을 잃기 직전!', 'すべて失う寸前！'),

  // End states — the number talks ({count} is a localized "312 words" chunk).
  burnedTitle: L('{count} burned.', '{count}가 불탔습니다.', '{count}が燃えました。'),
  survivedTitle: L('{count} survived.', '{count}가 살아남았습니다.', '{count}が生き残りました。'),
  burnedBody: L(
    'You paused longer than {fuse} seconds. The page is blank again.',
    '{fuse}초 넘게 멈췄습니다. 페이지가 다시 백지가 되었습니다.',
    '{fuse}秒以上止まりました。ページはまた白紙です。'
  ),
  survivedBody: L(
    '{elapsed} without stopping. They’re yours now.',
    '{elapsed} 동안 멈추지 않았습니다. 이제 당신의 것입니다.',
    '{elapsed}のあいだ止まりませんでした。もうあなたのものです。'
  ),

  // Document-mode toasts / notes.
  openDocFirst: L(
    'Open a document first to arm it.',
    '먼저 문서를 열어 무장하세요.',
    'まずドキュメントを開いて武装してください。'
  ),
  docArmed: L(
    'Document armed — keep typing or it gets wiped.',
    '문서 무장됨 — 계속 쓰지 않으면 지워집니다.',
    'ドキュメント武装 — 書き続けないと消去されます。'
  ),
  openDocToStart: L(
    'Open a document to arm it',
    '무장하려면 문서를 여세요',
    '武装するにはドキュメントを開く'
  ),

  // Clipboard lock — the note under the contract, and the toast on an attempt.
  clipNoteAll: L(
    'Copy and paste are locked while you write.',
    '쓰는 동안 복사·붙여넣기가 잠깁니다.',
    '書いているあいだ、コピーと貼り付けは使えません。'
  ),
  clipNotePaste: L(
    'Pasting is locked while you write.',
    '쓰는 동안 붙여넣기가 잠깁니다.',
    '書いているあいだ、貼り付けは使えません。'
  ),
  pasteLocked: L(
    'No pasting — the words have to be yours.',
    '붙여넣기 금지 — 직접 쓴 글이어야 합니다.',
    '貼り付けは禁止 — 自分で書いた言葉だけです。'
  ),
  copyLocked: L(
    'No copying — you can’t back up what you might burn.',
    '복사 금지 — 불탈 글을 미리 빼돌릴 수 없습니다.',
    'コピーは禁止 — 燃えるかもしれない原稿は持ち出せません。'
  ),

  words: L('words', '단어', '単語')
} as const;
