import type { CountOptions, HostApi } from '@pensiv/plugin-sdk';
import { STR, fmt, tr } from './i18n';

/**
 * What a session counts. `editor` counts the way the editor's own word counter does —
 * the figure the writer already watches in the status bar, words or characters,
 * spaces in or out — so a Korean writer who counts 글자 gets a character goal without
 * touching this. The rest pin a unit regardless of the editor setting.
 */
export type CountUnit = 'editor' | 'words' | 'chars' | 'chars_nospace';

const UNITS: readonly CountUnit[] = ['editor', 'words', 'chars', 'chars_nospace'];

/** A stored value back to a {@link CountUnit}; anything unknown follows the editor. */
export const toCountUnit = (raw: unknown): CountUnit =>
  UNITS.includes(raw as CountUnit) ? (raw as CountUnit) : 'editor';

/** The `editor.count` options a pinned unit counts with. */
export function countOptionsFor(unit: Exclude<CountUnit, 'editor'>): CountOptions {
  switch (unit) {
    case 'words':
      return { countType: 'word' };
    case 'chars':
      return { countType: 'character', includeSpace: true };
    case 'chars_nospace':
      return { countType: 'character', includeSpace: false };
  }
}

/**
 * The counter a session counts with, taken once when it starts. For `editor` that is the
 * editor's counter as configured at that moment, so changing the counter mid-run can't
 * shift the count away from the baseline it was measured against. `undefined` (no editor
 * to ask) falls back to the host's own default counter.
 */
export function sessionCountOptions(app: HostApi, unit: CountUnit): CountOptions | undefined {
  if (unit !== 'editor') return countOptionsFor(unit);
  try {
    return app.editor.wordCounter();
  } catch {
    return undefined;
  }
}

/** Whether a unit counts characters (for `editor`, whatever the counter is set to now). */
export function countsCharacters(app: HostApi, unit: CountUnit): boolean {
  const options = sessionCountOptions(app, unit);
  return options !== undefined && options.countType !== 'word';
}

/** "500 words" / "500자" — an amount in words or characters. */
export const amountLabel = (app: HostApi, chars: boolean, n: number): string =>
  fmt(tr(app, chars ? STR.nChars : STR.nWords), { n: n.toLocaleString() });
