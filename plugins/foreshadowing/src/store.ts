/**
 * The small amount of state that is *not* in the manuscript.
 *
 * Beats themselves live in the document as marks (`mark.ts`). Two things can't:
 *
 *  - **the manual tick.** A beat can be paid off off-page ("the reader worked it
 *    out"), and the writer wants it out of the open list. Marking it done is a
 *    reader-side judgement, not a change to the prose — and the setup usually
 *    lives in a file that isn't open, which the plugin cannot edit anyway.
 *  - **preferences.** Colours, whether sheets are scanned, and so on.
 *
 * Both go in `app.storage`, which is namespaced to this plugin and rides the
 * app's settings sync, so a tick made on the laptop shows on the phone.
 */
import type { HostApi } from '@pensiv/plugin-sdk';

export const DONE_KEY = 'doneThreads';
export const REOPENED_KEY = 'reopenedThreads';
export const DELETED_KEY = 'deletedThreads';

/** `gid` → ISO timestamp of when it was ticked. */
export type DoneMap = Record<string, string>;

export interface ForeshadowSettings {
  includeSheets: boolean;
  strikeResolved: boolean;
  highlightOpen: boolean;
  noteOnPlant: boolean;
}

export const SETTINGS_DEFAULTS: ForeshadowSettings = {
  includeSheets: true,
  strikeResolved: true,
  highlightOpen: true,
  // On by default: the moment of planting is the only moment the writer
  // reliably still knows how the beat is meant to land, and the sheet is one
  // Escape away for anyone who plants faster than they plan.
  noteOnPlant: true
};

export function readSettings(app: HostApi): ForeshadowSettings {
  return {
    includeSheets: app.storage.get<boolean>('includeSheets') ?? SETTINGS_DEFAULTS.includeSheets,
    strikeResolved: app.storage.get<boolean>('strikeResolved') ?? SETTINGS_DEFAULTS.strikeResolved,
    highlightOpen: app.storage.get<boolean>('highlightOpen') ?? SETTINGS_DEFAULTS.highlightOpen,
    noteOnPlant: app.storage.get<boolean>('noteOnPlant') ?? SETTINGS_DEFAULTS.noteOnPlant
  };
}

function readMap(app: HostApi, key: string): DoneMap {
  const stored = app.storage.get<DoneMap>(key);
  return stored && typeof stored === 'object' ? stored : {};
}

export function readDoneGids(app: HostApi): Set<string> {
  return new Set(Object.keys(readMap(app, DONE_KEY)));
}

/**
 * Beats the writer un-ticked even though a payoff mark exists in the text —
 * the reverse override of the manual tick. Kept as its own map (not `false`s in
 * the done map) so both stay presence-only and prune the same way.
 */
export function readReopenedGids(app: HostApi): Set<string> {
  return new Set(Object.keys(readMap(app, REOPENED_KEY)));
}

/**
 * Set / clear one gid in one of the override maps.
 *
 * Clearing **removes the key** rather than storing `false`: these maps are
 * written to synced settings, and a growing pile of `false`s would be a slow
 * leak in a blob that is rewritten on every change.
 */
function writeOverride(app: HostApi, key: string, gid: string, present: boolean): void {
  const next = { ...readMap(app, key) };
  if (present) {
    next[gid] = new Date().toISOString();
  } else {
    delete next[gid];
  }
  app.storage.set(key, next, { scope: 'synced' });
}

/** Tick / untick a thread that has no payoff in the text. */
export function setDoneByHand(app: HostApi, gid: string, done: boolean): void {
  writeOverride(app, DONE_KEY, gid, done);
}

/**
 * Reopen / re-close a thread that IS paid off in the text. The payoff marks
 * stay in the prose (they are anchors, and deleting them is an edit the writer
 * makes in the text); the override only changes what the list counts as open.
 */
export function setReopenedByHand(app: HostApi, gid: string, reopened: boolean): void {
  writeOverride(app, REOPENED_KEY, gid, reopened);
}

/**
 * Beats the writer deleted from the list. A tombstone, not just a removal: the
 * plugin can only edit the *active* editor, so a beat whose marks span files it
 * can't touch right now is tombstoned here (synced), hidden everywhere at once,
 * and its stray marks are swept out of each file the next time that file is
 * active (see the sweep in `list.tsx`). Once no file carries the gid any more,
 * the tombstone is pruned.
 */
export function readDeletedGids(app: HostApi): Set<string> {
  return new Set(Object.keys(readMap(app, DELETED_KEY)));
}

export function markThreadDeleted(app: HostApi, gid: string): void {
  writeOverride(app, DELETED_KEY, gid, true);
}

/** Drop tombstones whose gid no longer has a mark in any scanned file. */
export function pruneDeleted(app: HostApi, gidsWithMarks: ReadonlySet<string>): void {
  const current = readMap(app, DELETED_KEY);
  const kept: DoneMap = {};
  let dropped = false;
  for (const [gid, at] of Object.entries(current)) {
    if (gidsWithMarks.has(gid)) {
      kept[gid] = at;
    } else {
      dropped = true;
    }
  }
  if (dropped) app.storage.set(DELETED_KEY, kept, { scope: 'synced' });
}

/**
 * Forget overrides whose beat no longer exists. Called after a scan: a deleted
 * sentence takes its mark with it, and the tick that referred to it would
 * otherwise sit in synced settings forever.
 */
export function pruneDone(app: HostApi, liveGids: ReadonlySet<string>): void {
  for (const key of [DONE_KEY, REOPENED_KEY]) {
    const current = readMap(app, key);
    const kept: DoneMap = {};
    let dropped = false;
    for (const [gid, at] of Object.entries(current)) {
      if (liveGids.has(gid)) {
        kept[gid] = at;
      } else {
        dropped = true;
      }
    }
    if (dropped) app.storage.set(key, kept, { scope: 'synced' });
  }
}
