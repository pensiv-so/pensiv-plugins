import { resolveLocalizedText, type HostApi, type LocalizedText } from '@pensiv/plugin-sdk';

/** Shorthand for a three-language {@link LocalizedText} literal. */
export const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });

/** Resolve a {@link LocalizedText} in the live UI language. */
export const tr = (app: HostApi, text: LocalizedText): string =>
  resolveLocalizedText(text, app.app.locale);

/** Base BCP-47 language (`en`, `ko`, `ja`) for prompt/locale selection. */
export const baseLang = (app: HostApi): string => (app.app.locale || 'en').split('-')[0] ?? 'en';

/**
 * Runtime UI strings the plugin renders itself (schema labels use
 * {@link LocalizedText} resolved by the host). Mirrors the Dangerous Writing
 * Prompt App's wording across the three app languages.
 */
export const STR = {
  title: L('Dangerous Writing', '위험한 글쓰기', 'デンジャラス・ライティング'),
  tagline: L(
    'Keep writing — or lose it all.',
    '계속 쓰세요 — 아니면 전부 잃습니다.',
    '書き続けて — さもなければ全て失う。'
  ),
  start: L('Start writing', '글쓰기 시작', '書き始める'),
  stop: L('Stop', '중지', '停止'),
  cancel: L('Cancel', '취소', 'キャンセル'),
  tryAgain: L('Try again', '다시 시도', 'もう一度'),
  done: L('Done', '완료', '完了'),
  copy: L('Copy text', '텍스트 복사', 'テキストをコピー'),
  copied: L('Copied to clipboard', '클립보드에 복사됨', 'クリップボードにコピーしました'),
  newSession: L('New session', '새 세션', '新しいセッション'),
  settings: L('Settings', '설정', '設定'),

  goalTime: L('Time', '시간', '時間'),
  goalWords: L('Words', '단어', '単語'),
  words: L('words', '단어', '単語'),
  wordsLeft: L('to go', '남음', '残り'),
  prompt: L('Prompt', '프롬프트', 'お題'),
  noPrompt: L('Blank slate — write anything.', '백지 — 무엇이든 쓰세요.', '白紙 — 何でも書こう。'),

  // Live danger / status copy.
  keepTyping: L('Keep typing!', '계속 입력하세요!', '入力し続けて！'),
  dontStop: L("Don't stop…", '멈추지 마세요…', '止まらないで…'),
  aboutToLose: L('About to lose everything!', '모든 것을 잃기 직전!', 'すべて失う寸前！'),

  // End states.
  survived: L('You made it!', '해냈어요!', 'やり遂げた！'),
  survivedBody: L(
    'You reached your goal without stopping. Your words are safe.',
    '멈추지 않고 목표에 도달했습니다. 글이 안전합니다.',
    '止まらずに目標に到達しました。あなたの文章は無事です。'
  ),
  wiped: L('Wiped.', '삭제됨.', '消去。'),
  wipedBody: L(
    'You stopped for too long. Everything you wrote is gone.',
    '너무 오래 멈췄습니다. 작성한 모든 것이 사라졌습니다.',
    '止まりすぎました。書いたものはすべて消えました。'
  ),

  // Document-mode specifics.
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
  docWipedNote: L(
    'Your document was wiped.',
    '문서가 지워졌습니다.',
    'ドキュメントが消去されました。'
  ),

  // Stats.
  wordsWritten: L('Words written', '작성한 단어', '書いた単語'),
  timeSurvived: L('Time survived', '버틴 시간', '生き延びた時間'),

  // Launcher popover.
  openPane: L('Open practice pane', '연습 패널 열기', '練習ペインを開く'),
  armThisDoc: L('Arm this document', '이 문서 무장', 'このドキュメントを武装'),
  openDocToStart: L(
    'Open a document to arm it',
    '무장하려면 문서를 여세요',
    '武装するにはドキュメントを開く'
  ),
  runningInPane: L('Running in the practice pane', '연습 패널에서 진행 중', '練習ペインで進行中'),
  goToPane: L('Go to pane', '패널로 이동', 'ペインへ移動'),
  practiceMode: L('Practice pane', '연습 패널', '練習ペイン'),
  documentMode: L('Real document', '실제 문서', '実ドキュメント'),
  modeLabel: L('Mode', '모드', 'モード'),
  goalLabel: L('Goal', '목표', '目標'),
  fuseLabel: L('Fuse', '도화선', '導火線'),
  hardcoreLabel: L('Hardcore', '하드코어', 'ハードコア'),
  minutes: L('min', '분', '分')
} as const;
