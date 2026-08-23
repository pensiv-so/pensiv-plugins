/**
 * East Asian Width — how many terminal-ish columns a string occupies.
 *
 * ## Why a status window needs this
 *
 * Real Korean serials align their two-column sheets by padding with spaces:
 *
 * ```
 * 근력   : 415(+566)   체력   : 201(+420)
 * 생명력 : 360(+454)   민첩   :  62(+515)
 * ```
 *
 * `근력` is two characters but occupies four columns, so padding by
 * `String.length` puts the colons in the wrong place — the exact bug that makes
 * a generated block look generated. Every CJK glyph counts as two.
 *
 * ## What this can and cannot promise
 *
 * The manuscript editor renders in a proportional font, where no amount of space
 * padding aligns perfectly. That is fine and it is what the source material
 * assumes: these blocks are written to be **pasted into a publishing platform**
 * (네이버시리즈, 문피아, カクヨム, Royal Road), where the reader's column is
 * narrow and the font is closer to uniform. We match the convention the serials
 * use; we do not promise pixel alignment inside the editor.
 *
 * The table below is the Unicode `Wide` (W) and `Fullwidth` (F) ranges, trimmed
 * to what a novel actually contains — Hangul, kana, CJK ideographs, CJK
 * punctuation, fullwidth ASCII, and the enclosed/compat blocks. Ambiguous-width
 * characters (Greek, Cyrillic, box drawing) count as **one**, which is the right
 * call for mixed Korean/Latin text and matches how the sources are typeset.
 */

/** Inclusive `[start, end]` code point ranges that occupy two columns. */
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f], // Hangul Jamo initial consonants
  [0x2e80, 0x303e], // CJK Radicals, Kangxi, CJK Symbols and Punctuation (、。「」)
  [0x3041, 0x33ff], // Hiragana, Katakana, Bopomofo, Hangul Compat Jamo, Enclosed CJK, CJK Compat
  [0x3400, 0x4dbf], // CJK Unified Ideographs Extension A
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xa000, 0xa4cf], // Yi
  [0xa960, 0xa97c], // Hangul Jamo Extended-A
  [0xac00, 0xd7a3], // Hangul Syllables — the bulk of Korean text
  [0xd7b0, 0xd7c6], // Hangul Jamo Extended-B
  [0xd7cb, 0xd7fb],
  [0xf900, 0xfaff], // CJK Compatibility Ideographs
  [0xfe10, 0xfe19], // Vertical forms
  [0xfe30, 0xfe6b], // CJK Compatibility Forms, Small Form Variants
  [0xff01, 0xff60], // Fullwidth ASCII (fullwidth colon, U+3000, fullwidth letters)
  [0xffe0, 0xffe6], // Fullwidth signs
  [0x1f300, 0x1f64f], // Emoji (pictographs, emoticons)
  [0x1f900, 0x1f9ff],
  [0x20000, 0x2fffd], // CJK Extension B..F
  [0x30000, 0x3fffd]
];

/** Combining marks render on top of the previous glyph and take no column. */
const ZERO_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0300, 0x036f], // Combining Diacritical Marks
  [0x200b, 0x200f], // Zero-width space .. RTL mark
  [0xfe00, 0xfe0f], // Variation selectors
  [0xfe20, 0xfe2f], // Combining Half Marks
  [0x20d0, 0x20f0] // Combining Diacritical Marks for Symbols
];

function inRanges(cp: number, ranges: ReadonlyArray<readonly [number, number]>): boolean {
  // Linear scan: the tables are ~20 entries and this runs per character of a
  // status block (hundreds), not per character of the manuscript. A binary
  // search would be noise.
  for (const [start, end] of ranges) {
    if (cp < start) return false; // ranges are sorted, so we can stop early
    if (cp <= end) return true;
  }
  return false;
}

/** Columns occupied by one code point: 0, 1 or 2. */
export function charWidth(cp: number): number {
  if (cp === 0) return 0;
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0; // control characters
  if (inRanges(cp, ZERO_RANGES)) return 0;
  return inRanges(cp, WIDE_RANGES) ? 2 : 1;
}

/**
 * Columns occupied by a string. Iterates code points (not UTF-16 units), so
 * astral characters count once.
 */
export function stringWidth(text: string): number {
  let total = 0;
  for (const ch of text) {
    total += charWidth(ch.codePointAt(0) ?? 0);
  }
  return total;
}

/**
 * Pad `text` on the right to `columns`, using `pad` as the filler.
 *
 * `pad` is a whole character because Japanese sheets align with the ideographic
 * space U+3000 (two columns), not the ASCII space — padding those with `' '`
 * produces a visibly ragged edge next to fullwidth colons. Overlong input is
 * returned untouched rather than truncated: losing a stat name is worse than a
 * crooked column.
 */
export function padEnd(text: string, columns: number, pad = ' '): string {
  const unit = stringWidth(pad) || 1;
  const deficit = columns - stringWidth(text);
  if (deficit <= 0) return text;
  return text + pad.repeat(Math.ceil(deficit / unit));
}

/** Pad on the left — right-aligns numbers in a column (` 62(+515)`). */
export function padStart(text: string, columns: number, pad = ' '): string {
  const unit = stringWidth(pad) || 1;
  const deficit = columns - stringWidth(text);
  if (deficit <= 0) return text;
  return pad.repeat(Math.ceil(deficit / unit)) + text;
}

/** The widest of a set of strings, in columns. */
export function maxWidth(items: readonly string[]): number {
  let max = 0;
  for (const item of items) {
    const width = stringWidth(item);
    if (width > max) max = width;
  }
  return max;
}
