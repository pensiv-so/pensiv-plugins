import { describe, expect, it } from 'vitest';

import {
  analyzeDoc,
  analyzeUnits,
  classifyParagraph,
  countChars,
  extractUnits
} from '../src/analyze';

/**
 * The classifier is the plugin. Everything else — the pane, the settings form,
 * the analytics card — is a view of what these functions decide, so this is
 * where the three-script behaviour is pinned down.
 */

/** A ProseMirror paragraph node. */
const p = (...text: string[]) => ({
  type: 'paragraph',
  content: text.length ? text.map((t) => ({ type: 'text', text: t })) : undefined
});

const doc = (...content: unknown[]) => ({ type: 'doc', content });

describe('classifyParagraph — dialogue', () => {
  it('reads speech marks in every script', () => {
    expect(classifyParagraph('"안녕하세요."')).toBe('dialogue');
    expect(classifyParagraph('“Good morning,” she said.')).toBe('dialogue');
    expect(classifyParagraph('"Good morning," she said.')).toBe('dialogue');
    expect(classifyParagraph('「おはようございます」')).toBe('dialogue');
    expect(classifyParagraph('« Bonjour »')).toBe('dialogue');
  });

  it('stays dialogue when a speech tag trails the quote', () => {
    expect(classifyParagraph('"안녕." 그가 웃으며 말했다.')).toBe('dialogue');
    expect(classifyParagraph('「またね」と彼は言った。')).toBe('dialogue');
  });

  it('is narration when the quote is not what opens the paragraph', () => {
    expect(classifyParagraph('그가 말했다. "안녕."')).toBe('narration');
    expect(classifyParagraph('He said, "Good morning."')).toBe('narration');
  });
});

describe('classifyParagraph — monologue and special', () => {
  it('reads single quotes as inner voice', () => {
    expect(classifyParagraph('‘이건 아닌데.’')).toBe('monologue');
    expect(classifyParagraph("'This is wrong,' he thought.")).toBe('monologue');
  });

  it('reads parentheses as inner voice', () => {
    expect(classifyParagraph('(설마 들킨 건가?)')).toBe('monologue');
    expect(classifyParagraph('（まさか、気づかれた？）')).toBe('monologue');
  });

  it('reads the bracket family as special dialogue', () => {
    expect(classifyParagraph('[시스템] 레벨이 올랐습니다.')).toBe('special');
    expect(classifyParagraph('【스킬 획득】')).toBe('special');
    expect(classifyParagraph('〈전음〉 조심해라.')).toBe('special');
    expect(classifyParagraph('『告げる。汝は選ばれた』')).toBe('special');
  });

  it('honours a remapped group', () => {
    expect(classifyParagraph('(그는 웃었다)', { mapping: { round: 'narration' } })).toBe(
      'narration'
    );
    expect(classifyParagraph('『작품명』', { mapping: { doubleCorner: 'dialogue' } })).toBe(
      'dialogue'
    );
  });
});

describe('classifyParagraph — the traps', () => {
  it('does not mistake an apostrophe for a closing single quote', () => {
    expect(classifyParagraph("'Tis the season, and the town knew it.")).toBe('narration');
    expect(classifyParagraph("'Cause nobody else would.")).toBe('narration');
  });

  it('needs a closer before it commits to a bucket', () => {
    expect(classifyParagraph('"안녕하세요')).toBe('narration');
    expect(classifyParagraph('「まだ閉じていない')).toBe('narration');
  });

  it('sees through indentation, including the full-width space', () => {
    expect(classifyParagraph('　「おはよう」')).toBe('dialogue');
    expect(classifyParagraph('   "안녕."')).toBe('dialogue');
    expect(classifyParagraph('​　(속으로 생각했다)')).toBe('monologue');
  });

  it('reports blank paragraphs as empty rather than narration', () => {
    expect(classifyParagraph('')).toBe('empty');
    expect(classifyParagraph('   ')).toBe('empty');
    expect(classifyParagraph('　')).toBe('empty');
  });

  it('only reads a leading dash as speech when asked', () => {
    expect(classifyParagraph('— Hello, said the man.')).toBe('narration');
    expect(classifyParagraph('— Hello, said the man.', { dashDialogue: true })).toBe('dialogue');
  });
});

describe('countChars', () => {
  it('counts code points, not UTF-16 units', () => {
    expect(countChars('가나다')).toBe(3);
    expect(countChars('🙂🙂')).toBe(2);
    expect(countChars('𩸽を食べた')).toBe(5);
  });

  it('can exclude whitespace', () => {
    expect(countChars('a b c', false)).toBe(3);
    expect(countChars('a b c', true)).toBe(5);
  });
});

describe('extractUnits', () => {
  it('keeps empty paragraphs, which a plain-text join would erase', () => {
    expect(extractUnits(doc(p('첫 단락'), p(), p('둘째 단락')))).toEqual([
      '첫 단락',
      '',
      '둘째 단락'
    ]);
  });

  it('splits hard breaks into separate units by default', () => {
    const withBreak = {
      type: 'paragraph',
      content: [
        { type: 'text', text: '한 줄' },
        { type: 'hardBreak' },
        { type: 'text', text: '다음 줄' }
      ]
    };
    expect(extractUnits(doc(withBreak))).toEqual(['한 줄', '다음 줄']);
    expect(extractUnits(doc(withBreak), { splitOnHardBreak: false })).toEqual(['한 줄 다음 줄']);
  });

  it('leaves headings out unless asked, and never counts them as narration', () => {
    const heading = {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: '1장' }]
    };
    expect(extractUnits(doc(heading, p('본문')))).toEqual(['본문']);
    expect(extractUnits(doc(heading, p('본문')), { includeHeadings: true })).toEqual([
      '1장',
      '본문'
    ]);
  });

  it('reaches paragraphs nested inside containers, and skips code', () => {
    const nested = doc(
      { type: 'blockquote', content: [p('인용된 단락')] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [p('목록 항목')] }] },
      { type: 'codeBlock', content: [{ type: 'text', text: 'const a = 1;' }] }
    );
    expect(extractUnits(nested)).toEqual(['인용된 단락', '목록 항목']);
  });
});

describe('analyzeUnits', () => {
  const units = [
    '“Good morning,” she said.',
    '',
    'The kitchen smelled of burnt toast.',
    '',
    "'What now,' he thought.",
    '',
    '[SYSTEM] Level up.'
  ];

  it('splits the shares over non-empty paragraphs only', () => {
    const result = analyzeUnits(units);
    expect(result.units).toBe(7);
    expect(result.empty).toBe(3);
    expect(result.counted).toBe(4);

    const share = Object.fromEntries(result.kinds.map((k) => [k.kind, k.share]));
    expect(share.dialogue).toBeCloseTo(0.25);
    expect(share.narration).toBeCloseTo(0.25);
    expect(share.monologue).toBeCloseTo(0.25);
    expect(share.special).toBeCloseTo(0.25);
  });

  it('keeps empty paragraphs out of the average by default', () => {
    const withBlanks = ['가나다라마', '', '가나다라마', ''];
    expect(analyzeUnits(withBlanks).avgChars).toBe(5);
    expect(analyzeUnits(withBlanks, { excludeEmptyFromAverage: false }).avgChars).toBe(2.5);
  });

  it('estimates mobile lines per paragraph, never rounding a line away', () => {
    const result = analyzeUnits(['가'.repeat(56), '가'], { mobileLineChars: 28 });
    // 2 lines + 1 line over 2 paragraphs.
    expect(result.mobileLines).toBeCloseTo(1.5);
  });

  it('reports zeroes rather than NaN for an empty body', () => {
    const result = analyzeUnits(['', '   ']);
    expect(result.counted).toBe(0);
    expect(result.avgChars).toBe(0);
    expect(result.mobileLines).toBe(0);
    expect(result.kinds.every((k) => k.share === 0 && k.avgChars === 0)).toBe(true);
  });
});

describe('analyzeDoc', () => {
  it('walks a document end to end', () => {
    const result = analyzeDoc(
      doc(p('「行こう」'), p(), p('雨が降っていた。'), p('（まだ間に合う）'))
    );
    expect(result.units).toBe(4);
    expect(result.empty).toBe(1);
    expect(result.chars).toBe(5 + 8 + 8);

    const paragraphs = Object.fromEntries(result.kinds.map((k) => [k.kind, k.paragraphs]));
    expect(paragraphs).toEqual({ narration: 1, dialogue: 1, monologue: 1, special: 0 });
  });
});
