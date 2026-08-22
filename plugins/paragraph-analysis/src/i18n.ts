import { resolveLocalizedText, type HostApi, type LocalizedText } from '@pensiv/plugin-sdk';

import type { ParagraphAnalysis, ParagraphKind } from './analyze';

/** Shorthand for a three-language {@link LocalizedText} literal. */
export const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });

/** Resolve a {@link LocalizedText} in the live UI language. */
export const tr = (app: HostApi, text: LocalizedText): string =>
  resolveLocalizedText(text, app.app.locale);

/** `en` / `ko` / `ja`, with the region stripped — the key every formatter below branches on. */
export const baseLocale = (app: HostApi): string => (app.app.locale || 'en').split('-')[0] ?? 'en';

/**
 * Every runtime string, in one place — the pane, the settings form, the command
 * and the analytics card all read from here, so the four surfaces cannot drift
 * into three different words for "monologue".
 */
export const STR = {
  paneTitle: L('Paragraph Analysis', '단락 분석', '段落分析'),

  scopeFile: L('This file', '현재 문서', 'この文書'),
  scopeProject: L('Project', '프로젝트 전체', 'プロジェクト全体'),

  totalChars: L('Total length', '전체 분량', '総文字数'),
  avgParagraph: L('Average paragraph', '평균 단락', '平均段落'),
  totalParagraphs: L('Paragraphs', '전체 단락', '総段落数'),
  mobileEstimate: L('Mobile estimate', '모바일 예상', 'モバイル予測'),
  emptyParagraphs: L('Empty paragraphs', '빈 단락', '空の段落'),
  /** The mobile estimate's unit, on the stat card's hint line. */
  linesPerParagraph: L('lines per paragraph', '줄/단락', '行/段落'),
  /** Legend shorthand — the hint line is `41,310자 · 평균 8.5자`. */
  avgShort: L('avg', '평균', '平均'),

  narration: L('Narration', '묘사', '描写'),
  dialogue: L('Dialogue', '대사', 'セリフ'),
  monologue: L('Monologue', '독백', '独白'),
  special: L('Special dialogue', '특수 대사', '特殊セリフ'),

  emptyState: L(
    'Nothing to analyze yet — start writing.',
    '아직 분석할 본문이 없습니다.',
    '分析する本文がまだありません。'
  ),
  projectUnavailable: L(
    "This project's files are not readable right now.",
    '프로젝트 파일을 읽을 수 없습니다.',
    'プロジェクトのファイルを読み込めません。'
  ),

  copyCommand: L(
    'Paragraph Analysis: copy summary',
    '단락 분석: 요약 복사',
    '段落分析: 概要をコピー'
  ),
  copied: L('Summary copied', '요약을 복사했습니다', '概要をコピーしました'),
  copyFailed: L(
    'Could not copy the summary',
    '요약을 복사하지 못했습니다',
    '概要をコピーできませんでした'
  ),

  // ── settings ──────────────────────────────────────────────────────────────
  settingsCounting: L('Counting', '집계 방식', '集計方法'),
  settingsQuotes: L('Quote rules', '따옴표 규칙', '引用符のルール'),
  settingsQuotesHint: L(
    'Which bucket a paragraph falls into is decided by the glyph it opens with. Speech marks (“ ” " " 「 」 « ») are always dialogue; the ambiguous families are yours to assign.',
    '단락은 첫 글자로 분류됩니다. 말표(“ ” " " 「 」 « »)는 항상 대사이고, 애매한 기호들은 직접 지정합니다.',
    '段落は最初の文字で分類されます。かぎ括弧や引用符（“ ” " " 「 」 « »）は常にセリフで、曖昧な記号は自分で割り当てます。'
  ),

  includeHeadings: L('Count headings', '제목도 단락으로 셈', '見出しも段落に数える'),
  includeHeadingsHint: L(
    'Off by default — a chapter title is not prose.',
    '기본값은 꺼짐 — 챕터 제목은 본문이 아닙니다.',
    '既定はオフ — 章タイトルは本文ではありません。'
  ),
  splitOnHardBreak: L('Split on line breaks', '줄바꿈을 단락으로 분리', '改行を段落として分割'),
  splitOnHardBreakHint: L(
    'Treat a Shift+Enter line break as its own paragraph.',
    'Shift+Enter 줄바꿈을 별개의 단락으로 셉니다.',
    'Shift+Enterの改行を別の段落として数えます。'
  ),
  dashDialogue: L('Dash opens dialogue', '대시로 시작하면 대사', 'ダッシュで始まる行はセリフ'),
  dashDialogueHint: L(
    'For manuscripts that punctuate speech as “— Hello,” he said.',
    '“— 안녕.” 처럼 대시로 대사를 여는 원고에 사용합니다.',
    '「— こんにちは。」のようにダッシュでセリフを開く原稿向けです。'
  ),
  countSpaces: L('Count spaces', '공백 포함', '空白を含める'),
  countSpacesHint: L(
    'Include whitespace in the character totals.',
    '글자 수에 공백을 포함합니다.',
    '文字数に空白を含めます。'
  ),
  excludeEmpty: L(
    'Ignore empty paragraphs in the average',
    '평균에서 빈 단락 제외',
    '平均から空の段落を除く'
  ),
  excludeEmptyHint: L(
    'A manuscript that blank-lines between paragraphs otherwise reports half its real average.',
    '단락 사이에 빈 줄을 두는 원고는 이 설정을 끄면 평균이 실제의 절반으로 나옵니다.',
    '段落間に空行を置く原稿では、オフにすると平均が実際の半分になります。'
  ),
  mobileLineChars: L('Characters per mobile line', '모바일 한 줄 글자 수', 'モバイル1行の文字数'),
  mobileLineCharsHint: L(
    'Column width the mobile estimate assumes. About 28 for Korean and Japanese, 45 for English.',
    '모바일 예상이 가정하는 한 줄 길이. 한국어·일본어는 28자, 영어는 45자 정도입니다.',
    'モバイル予測が想定する1行の長さ。日本語・韓国語は28字、英語は45字ほどです。'
  ),

  mapSingle: L('Single quotes', '작은따옴표', '一重引用符'),
  mapRound: L('Parentheses', '소괄호', '丸括弧'),
  mapDoubleCorner: L('White corner brackets', '겹낫표', '二重かぎ括弧'),
  mapBrackets: L('Brackets', '대괄호류', '角括弧類'),
  mapAngles: L('Angle brackets', '홑화살괄호류', '山括弧類'),

  optDialogue: L('Dialogue', '대사', 'セリフ'),
  optMonologue: L('Monologue', '독백', '独白'),
  optSpecial: L('Special dialogue', '특수 대사', '特殊セリフ'),
  optNarration: L('Narration (not marked)', '묘사 (분류 안 함)', '描写（分類しない）'),

  // ── analytics ─────────────────────────────────────────────────────────────
  sectionDescription: L(
    'How the manuscript splits between narration and voice.',
    '원고가 묘사와 목소리로 어떻게 나뉘는지 보여줍니다.',
    '原稿が描写と声にどう分かれているかを示します。'
  ),
  sectionEmpty: L(
    'No prose in this project yet.',
    '아직 이 프로젝트에 본문이 없습니다.',
    'このプロジェクトにはまだ本文がありません。'
  )
} as const;

/** The legend/analytics label for one bucket. */
export const kindLabel = (app: HostApi, kind: ParagraphKind): string => tr(app, STR[kind]);

// ── number formatting ───────────────────────────────────────────────────────

export const formatCount = (app: HostApi, value: number): string =>
  Math.round(value).toLocaleString(app.app.locale || 'en');

/** One decimal place, and no trailing `.0` — `8.5자`, `17자`. */
export const formatDecimal = (app: HostApi, value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString(app.app.locale || 'en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  });
};

/**
 * `41,310 chars` / `41,310 자` / `41,310 字`. The unit is a suffix in CJK and a
 * separate word in English, so it cannot be a template with a translated label
 * bolted on.
 */
export const formatChars = (app: HostApi, value: number, decimal = false): string => {
  const n = decimal ? formatDecimal(app, value) : formatCount(app, value);
  const base = baseLocale(app);
  if (base === 'ko') return `${n}자`;
  if (base === 'ja') return `${n}字`;
  return `${n} ${Math.abs(value) === 1 ? 'char' : 'chars'}`;
};

export const formatParagraphs = (app: HostApi, value: number): string => {
  const n = formatCount(app, value);
  const base = baseLocale(app);
  if (base === 'ko') return `${n}단락`;
  if (base === 'ja') return `${n}段落`;
  return `${n} ${value === 1 ? 'paragraph' : 'paragraphs'}`;
};

/** The count pill and the empty-paragraph footer, which count items rather than prose. */
export const formatItems = (app: HostApi, value: number): string => {
  const n = formatCount(app, value);
  const base = baseLocale(app);
  if (base === 'ko') return `${n}개`;
  if (base === 'ja') return `${n}個`;
  return n;
};

export const formatLines = (app: HostApi, value: number): string => {
  const n = formatDecimal(app, value);
  const base = baseLocale(app);
  if (base === 'ko') return `${n} 줄/단락`;
  if (base === 'ja') return `${n} 行/段落`;
  return `${n} lines/para`;
};

export const formatPercent = (app: HostApi, share: number): string => `${Math.round(share * 100)}%`;

/** `4,861단락 · 41,310자 · 평균 8.5자` — the legend's right-hand detail. */
export const formatKindDetail = (
  app: HostApi,
  paragraphs: number,
  chars: number,
  avgChars: number
): string => {
  const base = baseLocale(app);
  const avgWord = base === 'ko' ? '평균' : base === 'ja' ? '平均' : 'avg';
  const parts = [
    formatParagraphs(app, paragraphs),
    formatChars(app, chars),
    `${avgWord} ${formatChars(app, avgChars, true)}`
  ];
  return parts.join(base === 'ja' ? '・' : ' · ');
};

/** Plain-text digest for the clipboard command. */
export const formatSummary = (app: HostApi, analysis: ParagraphAnalysis): string => {
  const lines = [
    `${tr(app, STR.paneTitle)}`,
    `${tr(app, STR.totalChars)}: ${formatChars(app, analysis.chars)}`,
    `${tr(app, STR.totalParagraphs)}: ${formatItems(app, analysis.units)}`,
    `${tr(app, STR.avgParagraph)}: ${formatChars(app, analysis.avgChars, true)}`,
    `${tr(app, STR.mobileEstimate)}: ${formatLines(app, analysis.mobileLines)}`,
    `${tr(app, STR.emptyParagraphs)}: ${formatItems(app, analysis.empty)}`,
    ...analysis.kinds.map(
      (stat) =>
        `${kindLabel(app, stat.kind)} (${formatPercent(app, stat.share)}) — ` +
        formatKindDetail(app, stat.paragraphs, stat.chars, stat.avgChars)
    )
  ];
  return lines.join('\n');
};
