/**
 * Host-facing half of the read path: turn "the project" into threads.
 *
 * Kept apart from `anchors.ts` (pure, unit-tested) so the walking logic never
 * needs a Host API to exercise.
 */
import type { HostApi } from '@pensiv/plugin-sdk';
import { buildThreads, collectAnchors, type Anchor, type Thread } from './anchors';
import { readDeletedGids, readDoneGids, readReopenedGids, readSettings } from './store';

export interface ProjectScan {
  threads: Thread[];
  /** File id → title, for the row's secondary line. */
  titles: Map<string, string>;
  /** Every gid that still has a mark somewhere — feeds tombstone pruning. */
  markGids: Set<string>;
  /** Tombstoned gids with marks still in the ACTIVE file — the sweep's to-do. */
  staleActiveGids: string[];
}

/**
 * Per-file anchor cache, keyed by the file's `updatedAt`.
 *
 * `app.project.content(id).doc` clones the file's whole body on access (the
 * host's leak guard), so walking every file on every rescan would structured-
 * clone the entire manuscript each debounce tick while the pane is open. A file
 * that hasn't been saved since the last scan can't have changed its marks —
 * non-active files are only edited by *becoming* active — so its anchors are
 * reused. The active file always reads live from the editor and never caches.
 *
 * Module-level on purpose: every list instance shares it, and it dies with the
 * plugin bundle on disable.
 */
const anchorCache = new Map<string, { updatedAt: string; anchors: Anchor[] }>();

/**
 * Walk every text-bearing file in the open project.
 *
 * The file the user is currently editing is read from the **editor** rather than
 * from project data: the store lags the editor by the debounced save, so a beat
 * planted five seconds ago would otherwise be missing from the list that is
 * supposed to show it.
 */
export function scanProject(app: HostApi): ProjectScan {
  const settings = readSettings(app);
  const done = readDoneGids(app);
  const reopened = readReopenedGids(app);
  const deleted = readDeletedGids(app);
  const activeFileId = app.app.fileId;
  const titles = new Map<string, string>();
  const anchors: Anchor[] = [];
  const seen = new Set<string>();

  const types = settings.includeSheets ? (['document', 'sheet'] as const) : (['document'] as const);

  for (const file of app.project.query({ type: [...types] })) {
    titles.set(file.id, file.title);
    seen.add(file.id);

    if (file.id === activeFileId) {
      anchors.push(...collectAnchors(app.editor.getDoc(), file.id));
      continue;
    }

    const cached = anchorCache.get(file.id);
    if (cached && cached.updatedAt === file.updatedAt) {
      anchors.push(...cached.anchors);
      continue;
    }

    const body = app.project.content(file.id);
    const fileAnchors = body ? collectAnchors(body.doc, file.id) : [];
    anchorCache.set(file.id, { updatedAt: file.updatedAt, anchors: fileAnchors });
    anchors.push(...fileAnchors);
  }

  // Entries for files that left the project (trashed, deleted, other project)
  // would otherwise sit in the cache forever.
  for (const key of [...anchorCache.keys()]) {
    if (!seen.has(key)) anchorCache.delete(key);
  }

  // An unsaved brand-new file may not be in project data yet; it still has beats.
  if (activeFileId && !titles.has(activeFileId)) {
    anchors.push(...collectAnchors(app.editor.getDoc(), activeFileId));
  }

  // Tombstoned beats are hidden from the list wholesale; their leftover marks
  // (in files that weren't active when the writer deleted) are reported so the
  // sweep can strip them once their file is the active one. Caveat: trashed
  // files aren't scanned, so a tombstone can be pruned while a mark hides in
  // the trash — restoring that file then resurrects the beat, which is the
  // less surprising failure of the two.
  const markGids = new Set(anchors.map((anchor) => anchor.gid));
  const staleActiveGids = [
    ...new Set(
      anchors
        .filter((anchor) => anchor.fileId === activeFileId && deleted.has(anchor.gid))
        .map((anchor) => anchor.gid)
    )
  ];
  const live = anchors.filter((anchor) => !deleted.has(anchor.gid));

  return { threads: buildThreads(live, done, reopened), titles, markGids, staleActiveGids };
}

/** Beats that live in one file, in reading order. */
export function threadsInFile(threads: readonly Thread[], fileId?: string): Thread[] {
  if (!fileId) return [];
  return threads
    .filter((thread) => thread.setup.fileId === fileId)
    .sort((a, b) => a.setup.from - b.setup.from);
}
