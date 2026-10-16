import type { HostApi } from '@pensiv/plugin-sdk';

/**
 * When the goal surfaces (floating card, phone sheet) fire their confetti.
 *
 * The rule: once per document, at the moment it goes from under its goal to at or
 * over it. A document that is already over its goal when it opens hasn't just
 * been completed, so the first reading for a document is only a baseline.
 */

/** What a goal surface remembers between renders. */
export interface GoalTracker {
  /** The document the remembered reading belongs to. */
  fileId: string | undefined;
  /** Whether the last reading for `fileId` was at or over the goal; `null` before the first. */
  achieved: boolean | null;
}

export interface GoalReading {
  fileId: string | undefined;
  achieved: boolean;
  /** Whether the host had a document to count — see {@link hasDocument}. */
  hasDocument: boolean;
}

export const createGoalTracker = (fileId: string | undefined): GoalTracker => ({
  fileId,
  achieved: null
});

/**
 * Whether the host has a document behind the count. With no editor (still
 * loading, or between one editor and the next) `editor.count` answers 0 — a
 * placeholder, not a reading.
 *
 * `getDoc()` serialises the whole document, and this runs on every keystroke, so
 * it is only asked when the count is 0: a non-zero count already proves there is
 * a document.
 */
export function hasDocument(app: Pick<HostApi, 'editor'>, count: number): boolean {
  if (count > 0) return true;
  try {
    return app.editor.getDoc() != null;
  } catch {
    return false;
  }
}

/**
 * Feed one reading; returns `true` when the caller should celebrate it, and
 * records the celebration in `celebratedDocs` so the document doesn't celebrate
 * again after dropping under the goal and back.
 *
 * Idempotent for a repeated reading, so calling it on every render is the same
 * as calling it only when the reading changes.
 */
export function shouldCelebrate(
  tracker: GoalTracker,
  storage: HostApi['storage'],
  reading: GoalReading
): boolean {
  if (tracker.fileId !== reading.fileId) {
    tracker.fileId = reading.fileId;
    tracker.achieved = null;
  }
  // No document, no reading. Taking the placeholder 0 as the baseline made a
  // document that finished loading after its pane opened look as if it had just
  // reached its goal.
  if (!reading.hasDocument) return false;
  if (tracker.achieved === null) {
    tracker.achieved = reading.achieved;
    return false;
  }
  const reached = reading.achieved && !tracker.achieved;
  tracker.achieved = reading.achieved;

  const { fileId } = reading;
  if (!reached || !fileId) return false;
  const celebrated = storage.get<Record<string, boolean>>('celebratedDocs') ?? {};
  if (celebrated[fileId] === true) return false;
  storage.set('celebratedDocs', { ...celebrated, [fileId]: true });
  return true;
}
