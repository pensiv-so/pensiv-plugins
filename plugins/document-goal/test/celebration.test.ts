import { describe, it, expect, vi } from 'vitest';
import type { HostApi } from '@pensiv/plugin-sdk';
import {
  createGoalTracker,
  hasDocument,
  shouldCelebrate,
  type GoalTracker
} from '../src/celebration';

/**
 * The goal card and the phone sheet both run `shouldCelebrate` from an effect on
 * every reading. These tests drive it the way the host does: the active editor
 * can be missing (pane opened, document not loaded yet) and arrive later, and
 * while it is missing the host's `count` answers 0 and `getDoc` answers null.
 */

const TARGET = 5000;

/** A host whose active editor can come and go, like `activeEditorAtom`. */
function fakeHost(initialWords: number | null) {
  let words = initialWords; // null = no active editor
  const store: Record<string, unknown> = {};
  const getDoc = vi.fn(() => (words === null ? null : { type: 'doc', content: [] }));
  const app = {
    editor: {
      count: () => words ?? 0,
      getDoc
    },
    storage: {
      get: (key: string) => store[key],
      set: (key: string, value: unknown) => {
        store[key] = value;
      },
      on: () => () => {}
    }
  } as unknown as HostApi;
  return {
    app,
    store,
    getDoc,
    /** Set the active editor's word count; `null` removes the editor. */
    setWords: (next: number | null) => {
      words = next;
    }
  };
}

/** One render of a goal surface: measure, then feed the reading to the tracker. */
function render(
  host: ReturnType<typeof fakeHost>,
  tracker: GoalTracker,
  fileId: string | undefined
) {
  const count = host.app.editor.count({ countType: 'word' });
  const achieved = TARGET > 0 && count >= TARGET;
  return shouldCelebrate(tracker, host.app.storage, {
    fileId,
    achieved,
    hasDocument: hasDocument(host.app, count)
  });
}

describe('shouldCelebrate', () => {
  it('does not celebrate a document already over its goal that loads after the pane opened', () => {
    const host = fakeHost(null);
    const tracker = createGoalTracker('doc-a');

    expect(render(host, tracker, 'doc-a')).toBe(false); // mounted, no editor yet
    host.setWords(6200); // the document finishes loading
    expect(render(host, tracker, 'doc-a')).toBe(false);
    host.setWords(6201); // keep typing
    expect(render(host, tracker, 'doc-a')).toBe(false);

    expect(host.store.celebratedDocs).toBeUndefined();
  });

  it('celebrates once when typing reaches the goal after a late-loading document', () => {
    const host = fakeHost(null);
    const tracker = createGoalTracker('doc-a');

    expect(render(host, tracker, 'doc-a')).toBe(false);
    host.setWords(4998);
    expect(render(host, tracker, 'doc-a')).toBe(false);
    host.setWords(4999);
    expect(render(host, tracker, 'doc-a')).toBe(false);
    host.setWords(5000);
    expect(render(host, tracker, 'doc-a')).toBe(true);
    expect(render(host, tracker, 'doc-a')).toBe(false); // same reading again

    // Dropping under and back over doesn't celebrate a second time.
    host.setWords(4990);
    expect(render(host, tracker, 'doc-a')).toBe(false);
    host.setWords(5010);
    expect(render(host, tracker, 'doc-a')).toBe(false);

    expect(host.store.celebratedDocs).toEqual({ 'doc-a': true });
  });

  it('celebrates when typing into an empty document reaches the goal', () => {
    const host = fakeHost(0); // an editor with nothing in it yet
    const tracker = createGoalTracker('doc-a');

    expect(render(host, tracker, 'doc-a')).toBe(false);
    host.setWords(5000);
    expect(render(host, tracker, 'doc-a')).toBe(true);
  });

  it('ignores a moment with no editor after the baseline was taken', () => {
    const host = fakeHost(6200);
    const tracker = createGoalTracker('doc-a');

    expect(render(host, tracker, 'doc-a')).toBe(false); // over the goal on open
    host.setWords(null); // editor torn down and rebuilt
    expect(render(host, tracker, 'doc-a')).toBe(false);
    host.setWords(6200);
    expect(render(host, tracker, 'doc-a')).toBe(false);
  });

  it('takes a fresh baseline when the document changes', () => {
    const host = fakeHost(100);
    const tracker = createGoalTracker('doc-a');

    expect(render(host, tracker, 'doc-a')).toBe(false); // doc-a, under the goal
    host.setWords(null);
    expect(render(host, tracker, 'doc-b')).toBe(false); // switched, doc-b not loaded yet
    host.setWords(7000);
    expect(render(host, tracker, 'doc-b')).toBe(false); // doc-b was already over

    host.setWords(4999);
    expect(render(host, tracker, 'doc-c')).toBe(false); // doc-c, under the goal
    host.setWords(5000);
    expect(render(host, tracker, 'doc-c')).toBe(true);

    expect(host.store.celebratedDocs).toEqual({ 'doc-c': true });
  });

  it('does not celebrate a document that was celebrated before', () => {
    const host = fakeHost(4999);
    host.store.celebratedDocs = { 'doc-a': true };
    const tracker = createGoalTracker('doc-a');

    expect(render(host, tracker, 'doc-a')).toBe(false);
    host.setWords(5000);
    expect(render(host, tracker, 'doc-a')).toBe(false);
  });

  it('never celebrates without a file id', () => {
    const host = fakeHost(4999);
    const tracker = createGoalTracker(undefined);

    expect(render(host, tracker, undefined)).toBe(false);
    host.setWords(5000);
    expect(render(host, tracker, undefined)).toBe(false);
    expect(host.store.celebratedDocs).toBeUndefined();
  });
});

describe('hasDocument', () => {
  it('trusts a non-zero count without serialising the document', () => {
    const host = fakeHost(12);
    expect(hasDocument(host.app, 12)).toBe(true);
    expect(host.getDoc).not.toHaveBeenCalled();
  });

  it('tells an empty document from no editor at all', () => {
    expect(hasDocument(fakeHost(0).app, 0)).toBe(true);
    expect(hasDocument(fakeHost(null).app, 0)).toBe(false);
  });

  it('treats a throwing host as no document', () => {
    const app = {
      editor: {
        getDoc: () => {
          throw new Error('editor destroyed');
        }
      }
    } as unknown as HostApi;
    expect(hasDocument(app, 0)).toBe(false);
  });
});
