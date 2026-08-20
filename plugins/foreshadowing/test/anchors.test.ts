/**
 * The walker is the part that can be silently wrong: a position that is off by a
 * block boundary still "works" — it just sends the writer to the wrong sentence.
 * So the positions are asserted against hand-counted ProseMirror offsets.
 */
import { describe, expect, it } from 'vitest';
import { buildThreads, collectAnchors, summarize, threadLabel, threadNote } from '../src/anchors';

const mark = (attrs: Record<string, string>) => ({ type: 'foreshadow', attrs });

/**
 * doc
 *  └ paragraph        opens at 0, so its text starts at 1
 *     ├ "The " (1–5)
 *     ├ "ring"  (5–9)   ← marked
 *     └ " sat." (9–14)
 *  └ paragraph        opens at 15 (14 = close of the first), text starts at 16
 *     └ "Later." (16–22)
 */
const doc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'The ' },
        {
          type: 'text',
          text: 'ring',
          marks: [mark({ fid: 'a', gid: 'a', kind: 'setup', label: '' })]
        },
        { type: 'text', text: ' sat.' }
      ]
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Later.',
          marks: [mark({ fid: 'b', gid: 'a', kind: 'payoff', label: '' })]
        }
      ]
    }
  ]
};

describe('collectAnchors', () => {
  it('reports real ProseMirror positions, not string offsets', () => {
    const [setup, payoff] = collectAnchors(doc, 'doc-1');
    expect(setup).toMatchObject({ fid: 'a', from: 5, to: 9, quote: 'ring' });
    // The second paragraph's text starts at 16, not at 14 — the two block
    // boundaries cost two positions the plain text does not have.
    expect(payoff).toMatchObject({ fid: 'b', from: 16, to: 22, quote: 'Later.' });
  });

  it('merges a span split across text nodes, and stops at a gap', () => {
    const split = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a ', marks: [mark({ fid: 'x', gid: 'x', kind: 'setup' })] },
            { type: 'text', text: 'bold', marks: [mark({ fid: 'x', gid: 'x', kind: 'setup' })] },
            { type: 'text', text: ' tail' }
          ]
        }
      ]
    };
    const [anchor] = collectAnchors(split, 'doc-1');
    expect(anchor).toMatchObject({ from: 1, to: 7, quote: 'a bold' });
  });

  it('ignores other marks and unmarked text', () => {
    const noisy = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'plain', marks: [{ type: 'bold', attrs: {} }] }]
        }
      ]
    };
    expect(collectAnchors(noisy, 'doc-1')).toEqual([]);
  });

  it('survives a missing or malformed document', () => {
    expect(collectAnchors(null, 'doc-1')).toEqual([]);
    expect(collectAnchors({}, 'doc-1')).toEqual([]);
    expect(collectAnchors({ type: 'doc', content: [] }, 'doc-1')).toEqual([]);
  });

  it('drops a mark with no id rather than inventing one', () => {
    const broken = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'x', marks: [mark({ kind: 'setup' })] }]
        }
      ]
    };
    expect(collectAnchors(broken, 'doc-1')).toEqual([]);
  });

  it('counts nested blocks (a list) correctly', () => {
    // doc → bulletList(0) → listItem(1) → paragraph(2) → text starts at 3
    const nested = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'clue',
                      marks: [mark({ fid: 'n', gid: 'n', kind: 'setup' })]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };
    expect(collectAnchors(nested, 'doc-1')[0]).toMatchObject({ from: 3, to: 7 });
  });
});

describe('buildThreads', () => {
  const anchors = collectAnchors(doc, 'doc-1');

  it('pairs a payoff with its setup by group id', () => {
    const [thread] = buildThreads(anchors, new Set());
    if (!thread) throw new Error('expected a thread');
    expect(thread.gid).toBe('a');
    expect(thread.payoffs).toHaveLength(1);
    expect(thread.resolved).toBe(true);
    expect(thread.resolvedByHand).toBe(false);
  });

  it('treats a hand-ticked beat as resolved, and says so', () => {
    const setupOnly = collectAnchors(doc, 'doc-1').filter((a) => a.kind === 'setup');
    const [thread] = buildThreads(setupOnly, new Set(['a']));
    if (!thread) throw new Error('expected a thread');
    expect(thread.resolved).toBe(true);
    expect(thread.resolvedByHand).toBe(true);
  });

  it('drops an orphan payoff instead of listing it as a beat', () => {
    const orphan = collectAnchors(doc, 'doc-1').filter((a) => a.kind === 'payoff');
    expect(buildThreads(orphan, new Set())).toEqual([]);
  });

  it('keeps one row when a marked sentence was copy-pasted', () => {
    const duplicated = [...anchors, ...collectAnchors(doc, 'doc-2')];
    expect(buildThreads(duplicated, new Set())).toHaveLength(1);
  });

  it('reopens a paid-off beat when the writer unticks it', () => {
    const [thread] = buildThreads(anchors, new Set(), new Set(['a']));
    if (!thread) throw new Error('expected a thread');
    expect(thread.payoffs).toHaveLength(1);
    expect(thread.resolved).toBe(false);
    expect(thread.resolvedByHand).toBe(false);
  });

  it('ignores a reopen override on a beat with no payoff in the text', () => {
    const setupOnly = collectAnchors(doc, 'doc-1').filter((a) => a.kind === 'setup');
    const [thread] = buildThreads(setupOnly, new Set(['a']), new Set(['a']));
    if (!thread) throw new Error('expected a thread');
    // The done tick governs when nothing in the text resolves the beat.
    expect(thread.resolved).toBe(true);
    expect(thread.resolvedByHand).toBe(true);
  });
});

describe('summarize', () => {
  it('reports a rate of 0 for a manuscript with no beats, never NaN', () => {
    expect(summarize([])).toEqual({ total: 0, resolved: 0, open: 0, rate: 0 });
  });

  it('counts open vs resolved', () => {
    const threads = buildThreads(collectAnchors(doc, 'doc-1'), new Set());
    expect(summarize(threads)).toMatchObject({ total: 1, resolved: 1, open: 0, rate: 1 });
  });
});

describe('threadLabel', () => {
  it('prefers the writer label and falls back to the marked text', () => {
    const [thread] = buildThreads(collectAnchors(doc, 'doc-1'), new Set());
    if (!thread) throw new Error('expected a thread');
    expect(threadLabel(thread)).toBe('ring');
    expect(threadLabel({ ...thread, setup: { ...thread.setup, label: 'The ring' } })).toBe(
      'The ring'
    );
  });
});

describe('the note', () => {
  it('is read off the mark', () => {
    const noted = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'ring',
              marks: [
                mark({ fid: 'a', gid: 'a', kind: 'setup', label: '', note: "It's his mother's." })
              ]
            }
          ]
        }
      ]
    };
    const [thread] = buildThreads(collectAnchors(noted, 'doc-1'), new Set());
    if (!thread) throw new Error('expected a thread');
    expect(threadNote(thread)).toBe("It's his mother's.");
  });

  /** Every beat planted before this feature shipped has no `note` attribute. */
  it('reads as empty on a beat from before notes existed', () => {
    const [thread] = buildThreads(collectAnchors(doc, 'doc-1'), new Set());
    if (!thread) throw new Error('expected a thread');
    expect(thread.setup.note).toBe('');
    expect(threadNote(thread)).toBe('');
  });

  it('comes from the setup, never from a payoff', () => {
    const [thread] = buildThreads(collectAnchors(doc, 'doc-1'), new Set());
    if (!thread) throw new Error('expected a thread');
    const withNotedPayoff = {
      ...thread,
      setup: { ...thread.setup, note: 'the plan' },
      payoffs: thread.payoffs.map((payoff) => ({ ...payoff, note: 'stale copy' }))
    };
    expect(threadNote(withNotedPayoff)).toBe('the plan');
  });
});
