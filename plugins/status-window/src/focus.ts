/**
 * Hand-off from the prose to the pane: "open on this character", "open the
 * system-message composer".
 *
 * The gesture that asks (a surface action, a slash item) runs before the side
 * pane it opens (`app.ui.openPaneView`) mounts — or while one is already
 * mounted, showing something else. So the request is parked here: a pane
 * mounting consumes it, a pane already open hears it through the listener.
 * Module state, not storage — this is a UI gesture, not data.
 */
export type PaneRequest = { kind: 'character'; id: string } | { kind: 'system' };

let pending: PaneRequest | undefined;
const listeners = new Set<(request: PaneRequest) => void>();

function request(next: PaneRequest): void {
  pending = next;
  listeners.forEach((fn) => fn(next));
  // Heard by a live pane — don't let a stale request re-fire on a later mount.
  if (listeners.size > 0) pending = undefined;
}

/** Ask whichever pane exists (or mounts next) to show this character. */
export function focusCharacter(id: string): void {
  request({ kind: 'character', id });
}

/** Ask it to open on the system-message composer instead of the rows. */
export function focusSystemMessage(): void {
  request({ kind: 'system' });
}

/** One-shot read at mount time. */
export function consumePaneRequest(): PaneRequest | undefined {
  const next = pending;
  pending = undefined;
  return next;
}

export function onPaneRequest(fn: (request: PaneRequest) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
