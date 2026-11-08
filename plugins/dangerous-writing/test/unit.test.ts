import { describe, it, expect } from 'vitest';
import type { CountOptions, HostApi } from '@pensiv/plugin-sdk';
import { amountLabel, countsCharacters, sessionCountOptions, toCountUnit } from '../src/unit';
import { documentHooks } from '../src/document';

/** Just enough of the host: the editor's counter (mutable), a counting stub, the UI locale. */
const fakeApp = (counter: CountOptions, locale = 'ko') => {
  const calls: (CountOptions | undefined)[] = [];
  const app = {
    editor: {
      wordCounter: () => ({ ...counter }),
      count: (options?: CountOptions) => {
        calls.push(options);
        return 0;
      }
    },
    app: { locale }
  } as unknown as HostApi;
  return { app, calls, counter };
};

describe('count units', () => {
  it('pins words / characters regardless of the editor counter', () => {
    const { app } = fakeApp({ countType: 'word' });
    expect(sessionCountOptions(app, 'words')).toEqual({ countType: 'word' });
    expect(sessionCountOptions(app, 'chars')).toEqual({
      countType: 'character',
      includeSpace: true
    });
    expect(sessionCountOptions(app, 'chars_nospace')).toEqual({
      countType: 'character',
      includeSpace: false
    });
  });

  it('reads an unknown or missing stored unit as the editor setting', () => {
    expect(toCountUnit(undefined)).toBe('editor');
    expect(toCountUnit('pages')).toBe('editor');
    expect(toCountUnit('chars')).toBe('chars');
  });

  it('follows the editor counter for the editor setting', () => {
    const chars = fakeApp({ countType: 'character', includeSpace: false });
    expect(sessionCountOptions(chars.app, 'editor')).toEqual({
      countType: 'character',
      includeSpace: false
    });
    expect(countsCharacters(chars.app, 'editor')).toBe(true);
    expect(countsCharacters(fakeApp({ countType: 'word' }).app, 'editor')).toBe(false);
  });

  it('keeps counting with the counter a session started with', () => {
    const { app, calls, counter } = fakeApp({ countType: 'character', includeSpace: true });
    const hooks = documentHooks(app, sessionCountOptions(app, 'editor'));
    hooks.words();
    // The writer switches the editor counter to words mid-run.
    counter.countType = 'word';
    hooks.words();
    expect(calls).toEqual([
      { countType: 'character', includeSpace: true },
      { countType: 'character', includeSpace: true }
    ]);
  });

  it('labels an amount in words or characters', () => {
    const { app } = fakeApp({ countType: 'word' });
    expect(amountLabel(app, true, 5000)).toBe('5,000자');
    expect(amountLabel(app, false, 500)).toBe('500단어');
  });
});
