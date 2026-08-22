/**
 * The engine, as pure functions over ProseMirror JSON — no host, no React — so
 * the classification is testable on its own and arguable in one file.
 *
 * **The principle.** A paragraph is bucketed by the *glyph it opens with*, never
 * by what it says. If the first character is a quote opener and its matching
 * closer appears later in the same paragraph, the paragraph belongs to that
 * glyph group's bucket; otherwise it is narration. That is the whole rule.
 *
 * Buckets are assigned per **glyph group**, not per language, on purpose. A
 * Korean manuscript quotes a Japanese line with `「」`; an English one is as
 * likely to hold `“…”` as `"…"`. Keying off the locale would misread all three,
 * so one table covers every script and the ambiguous groups are user-mappable
 * ({@link AnalyzeOptions.mapping}).
 *
 * What the table cannot see, and neither can we: English inner monologue is
 * carried by italics, which plain text does not preserve. English manuscripts
 * therefore read narration-heavy, and that is correct rather than a bug.
 */

/** The four buckets a non-empty paragraph can land in. */
export type ParagraphKind = 'narration' | 'dialogue' | 'monologue' | 'special';

/** Fixed display order — the legend and the stacked bar both read it. */
export const PARAGRAPH_KINDS: readonly ParagraphKind[] = [
  'narration',
  'dialogue',
  'monologue',
  'special'
] as const;

/**
 * A quote *group*, i.e. one open/close glyph pair. Grouped rather than listed
 * one glyph at a time because the settings map whole groups ("all brackets are
 * system messages"), and because a writer who types `“` in one paragraph and `"`
 * in the next means the same thing both times.
 */
export type QuoteGroup =
  | 'curlyDouble'
  | 'straightDouble'
  | 'corner'
  | 'guillemets'
  | 'curlySingle'
  | 'straightSingle'
  | 'round'
  | 'fullwidthRound'
  | 'doubleCorner'
  | 'square'
  | 'fullwidthSquare'
  | 'lenticular'
  | 'tortoise'
  | 'angle'
  | 'doubleAngle'
  | 'curlyBrace';

interface QuotePair {
  group: QuoteGroup;
  open: string;
  close: string;
}

/**
 * Ordered longest-first is unnecessary here (every opener is one code point),
 * but order still matters for the same-glyph pairs: they are matched by scanning
 * for a *second* occurrence, so they must be tried after their curly cousins.
 */
const PAIRS: readonly QuotePair[] = [
  { group: 'curlyDouble', open: '“', close: '”' }, // “ ”
  { group: 'straightDouble', open: '"', close: '"' },
  { group: 'corner', open: '「', close: '」' }, // 「 」
  { group: 'guillemets', open: '«', close: '»' }, // « »
  { group: 'curlySingle', open: '‘', close: '’' }, // ‘ ’
  { group: 'straightSingle', open: "'", close: "'" },
  { group: 'round', open: '(', close: ')' },
  { group: 'fullwidthRound', open: '（', close: '）' }, // （ ）
  { group: 'doubleCorner', open: '『', close: '』' }, // 『 』
  { group: 'square', open: '[', close: ']' },
  { group: 'fullwidthSquare', open: '［', close: '］' }, // ［ ］
  { group: 'lenticular', open: '【', close: '】' }, // 【 】
  { group: 'tortoise', open: '〔', close: '〕' }, // 〔 〕
  { group: 'angle', open: '〈', close: '〉' }, // 〈 〉
  { group: 'doubleAngle', open: '《', close: '》' }, // 《 》
  { group: 'curlyBrace', open: '{', close: '}' }
];

/**
 * Defaults chosen from what the three markets actually type:
 *
 * - **Speech** — `“…”` / `"…"` everywhere, `「…」` in Japanese, `«…»` in
 *   translated European fiction.
 * - **Inner voice** — `‘…’` in Korean web fiction, `（…）` in Japanese.
 * - **Special** — the bracket family, which Korean and Japanese web novels use
 *   for system windows, status messages and telepathy (`【시스템】`, `〈전음〉`).
 *
 * Every ambiguous group is overridable, because these are conventions rather
 * than rules and a given author's are the ones that matter.
 */
export const DEFAULT_MAPPING: Readonly<Record<QuoteGroup, ParagraphKind>> = {
  curlyDouble: 'dialogue',
  straightDouble: 'dialogue',
  corner: 'dialogue',
  guillemets: 'dialogue',
  curlySingle: 'monologue',
  straightSingle: 'monologue',
  round: 'monologue',
  fullwidthRound: 'monologue',
  doubleCorner: 'special',
  square: 'special',
  fullwidthSquare: 'special',
  lenticular: 'special',
  tortoise: 'special',
  angle: 'special',
  doubleAngle: 'special',
  curlyBrace: 'special'
};

export interface AnalyzeOptions {
  /** Per-group overrides on top of {@link DEFAULT_MAPPING}. */
  mapping?: Partial<Record<QuoteGroup, ParagraphKind>>;
  /** Count headings as paragraphs. Default `false` — a chapter title is not prose. */
  includeHeadings?: boolean;
  /**
   * Treat a hard break (Shift+Enter) as a paragraph boundary. Default `true`:
   * writers who never press Enter would otherwise show one 4,000-character
   * "paragraph".
   */
  splitOnHardBreak?: boolean;
  /** Treat a leading em/en dash as speech (European convention). Default `false`. */
  dashDialogue?: boolean;
  /** Count whitespace toward the character totals. Default `true`. */
  countSpaces?: boolean;
  /**
   * Leave empty paragraphs out of the average. Default `true` — a manuscript
   * that blank-lines between paragraphs otherwise reports half its real average.
   */
  excludeEmptyFromAverage?: boolean;
  /** Characters per line used for the mobile estimate. Default `28`. */
  mobileLineChars?: number;
}

interface ResolvedOptions extends Required<Omit<AnalyzeOptions, 'mapping'>> {
  mapping: Record<QuoteGroup, ParagraphKind>;
}

const resolve = (options: AnalyzeOptions = {}): ResolvedOptions => ({
  mapping: { ...DEFAULT_MAPPING, ...options.mapping },
  includeHeadings: options.includeHeadings ?? false,
  splitOnHardBreak: options.splitOnHardBreak ?? true,
  dashDialogue: options.dashDialogue ?? false,
  countSpaces: options.countSpaces ?? true,
  excludeEmptyFromAverage: options.excludeEmptyFromAverage ?? true,
  mobileLineChars: Math.max(1, Math.round(options.mobileLineChars ?? 28))
});

// ── text hygiene ────────────────────────────────────────────────────────────

/**
 * `\s` already covers the full-width space (U+3000) and the NBSP, which is most
 * of what an imported manuscript indents with; the zero-width family does not
 * and has to be named. Trimming before classification is not cosmetic — a single
 * leading full-width space (U+3000, what a pasted Japanese manuscript indents
 * with) would push the quote off position 0 and turn every line of dialogue in
 * the file into narration.
 */
const EDGE_BLANK = /^[\s\u200B-\u200D\uFEFF]+|[\s\u200B-\u200D\uFEFF]+$/g;

export const trimParagraph = (text: string): string => text.replace(EDGE_BLANK, '');

/**
 * Code points, not UTF-16 units: `str.length` counts an emoji or a rare CJK
 * ideograph twice, which is visible on a manuscript-sized total.
 */
export const countChars = (text: string, countSpaces = true): number =>
  [...(countSpaces ? text : text.replace(/\s/g, ''))].length;

// ── classification ──────────────────────────────────────────────────────────

/** Characters that may legally follow a closing quote. */
const AFTER_CLOSE = /[\s,.;:!?~…—–\-)\]}」』】〉》"'”’]/;

/**
 * Find the closing glyph for a pair that opened at index 0.
 *
 * Same-glyph pairs (`"…"`, `'…'`) need the guard: an apostrophe is the same code
 * point as a closing single quote, so `'Tis a fine morning` would otherwise
 * match at "morning"'s apostrophe — or, worse, `'Cause` would swallow the rest
 * of the paragraph. Requiring the candidate to be followed by end-of-line,
 * space or punctuation is what separates a real closer from a contraction.
 */
const findClose = (text: string, pair: QuotePair): number => {
  if (pair.open !== pair.close) return text.indexOf(pair.close, 1);

  for (let i = 1; i < text.length; i += 1) {
    if (text[i] !== pair.close) continue;
    const next = text[i + 1];
    if (next === undefined || AFTER_CLOSE.test(next)) return i;
  }
  return -1;
};

/**
 * Bucket one paragraph. `'empty'` is not a bucket — it is the absence of one,
 * and the reason it is reported separately everywhere downstream.
 */
export const classifyParagraph = (
  text: string,
  options: AnalyzeOptions = {}
): ParagraphKind | 'empty' => {
  const opts = resolve(options);
  const trimmed = trimParagraph(text);
  if (trimmed === '') return 'empty';

  // `— Hello,` said the man.  Off by default: an em dash also opens an aside,
  // and a wrong guess here recolours a whole manuscript.
  if (opts.dashDialogue && /^[—–]\s?\S/.test(trimmed)) return 'dialogue';

  const first = [...trimmed][0];
  for (const pair of PAIRS) {
    if (pair.open !== first) continue;
    if (findClose(trimmed, pair) > 0) return opts.mapping[pair.group];
    // An opener with no closer is an unfinished line or a stray glyph, not a
    // bucket. Fall through rather than guessing.
    break;
  }
  return 'narration';
};

// ── extraction ──────────────────────────────────────────────────────────────

interface PmNode {
  type?: string;
  text?: string;
  content?: PmNode[];
}

/** Blocks that hold no prose. Everything else is recursed into. */
const SKIPPED_BLOCKS = new Set([
  'codeBlock',
  'code_block',
  'horizontalRule',
  'horizontal_rule',
  'image',
  'imageBlock',
  'video',
  'embed',
  'iframe'
]);

const HARD_BREAKS = new Set(['hardBreak', 'hard_break']);

/** Concatenate a block's inline text, hard breaks becoming newlines. */
const inlineText = (node: PmNode): string => {
  if (typeof node.text === 'string') return node.text;
  if (node.type && HARD_BREAKS.has(node.type)) return '\n';
  if (!node.content) return '';
  return node.content.map(inlineText).join('');
};

/**
 * Flatten a ProseMirror document into the units the writer perceives as
 * paragraphs.
 *
 * Reading `doc` rather than `editor.getText()` is deliberate: `getText()` joins
 * blocks with a separator, so an empty paragraph and a paragraph break are the
 * same two newlines by the time you see them — and the empty-paragraph count,
 * which is the whole point of the footer row, becomes unrecoverable.
 */
export const extractUnits = (doc: unknown, options: AnalyzeOptions = {}): string[] => {
  const opts = resolve(options);
  const units: string[] = [];

  const walk = (node: PmNode | undefined): void => {
    if (!node || typeof node !== 'object') return;
    const type = node.type;
    if (type && SKIPPED_BLOCKS.has(type)) return;

    const isParagraph = type === 'paragraph' || (type === 'heading' && opts.includeHeadings);
    if (isParagraph) {
      const text = inlineText(node);
      if (opts.splitOnHardBreak) units.push(...text.split('\n'));
      else units.push(text.replace(/\n/g, ' '));
      return;
    }
    if (type === 'heading') return; // counted out entirely, not as narration
    node.content?.forEach(walk);
  };

  walk(doc as PmNode);
  return units;
};

// ── aggregation ─────────────────────────────────────────────────────────────

export interface ParagraphKindStat {
  kind: ParagraphKind;
  paragraphs: number;
  chars: number;
  /** Mean characters per paragraph of this kind; `0` when it has none. */
  avgChars: number;
  /** Share of non-empty paragraphs, `0..1`. */
  share: number;
}

export interface ParagraphAnalysis {
  /** Every unit found, empty ones included. */
  units: number;
  empty: number;
  /** Units with text — the denominator for every share. */
  counted: number;
  chars: number;
  /** Mean characters per paragraph, over counted units unless configured otherwise. */
  avgChars: number;
  /** Mean rendered lines per paragraph on a phone-width column. */
  mobileLines: number;
  kinds: ParagraphKindStat[];
}

const EMPTY_ANALYSIS = (): ParagraphAnalysis => ({
  units: 0,
  empty: 0,
  counted: 0,
  chars: 0,
  avgChars: 0,
  mobileLines: 0,
  kinds: PARAGRAPH_KINDS.map((kind) => ({
    kind,
    paragraphs: 0,
    chars: 0,
    avgChars: 0,
    share: 0
  }))
});

/** Aggregate already-extracted units. */
export const analyzeUnits = (
  units: readonly string[],
  options: AnalyzeOptions = {}
): ParagraphAnalysis => {
  const opts = resolve(options);
  const result = EMPTY_ANALYSIS();
  const byKind = new Map(result.kinds.map((stat) => [stat.kind, stat]));
  let lineSum = 0;

  for (const raw of units) {
    result.units += 1;
    const trimmed = trimParagraph(raw);
    if (trimmed === '') {
      result.empty += 1;
      continue;
    }

    const kind = classifyParagraph(trimmed, options) as ParagraphKind;
    const chars = countChars(trimmed, opts.countSpaces);
    const stat = byKind.get(kind);
    if (stat) {
      stat.paragraphs += 1;
      stat.chars += chars;
    }
    result.counted += 1;
    result.chars += chars;

    // Wrapping is visual, so it measures the rendered string — spaces included
    // even when the character total excludes them — and never rounds to zero:
    // a one-character paragraph still occupies a line.
    lineSum += Math.max(1, Math.ceil(countChars(trimmed, true) / opts.mobileLineChars));
  }

  const averageOver = opts.excludeEmptyFromAverage ? result.counted : result.units;
  result.avgChars = averageOver > 0 ? result.chars / averageOver : 0;
  result.mobileLines = averageOver > 0 ? lineSum / averageOver : 0;

  for (const stat of result.kinds) {
    stat.avgChars = stat.paragraphs > 0 ? stat.chars / stat.paragraphs : 0;
    stat.share = result.counted > 0 ? stat.paragraphs / result.counted : 0;
  }

  return result;
};

/** Analyze one ProseMirror document. */
export const analyzeDoc = (doc: unknown, options: AnalyzeOptions = {}): ParagraphAnalysis =>
  analyzeUnits(extractUnits(doc, options), options);

/** Analyze several documents as one body of text (the project scope). */
export const analyzeDocs = (
  docs: readonly unknown[],
  options: AnalyzeOptions = {}
): ParagraphAnalysis =>
  analyzeUnits(
    docs.flatMap((doc) => extractUnits(doc, options)),
    options
  );
