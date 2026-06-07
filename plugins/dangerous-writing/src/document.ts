import type { HostApi } from '@pensiv/plugin-sdk';
import { dwStore, type SessionHooks } from './store';
import { readConfig } from './settings';
import { STR, tr } from './i18n';

/**
 * Document-mode target: the session counts and wipes the REAL active editor.
 * The wipe uses `resetHistory: true` so it cannot be undone — the SDK's stated
 * "dangerous writing wiping the document for real". Both calls are guarded so a
 * missing editor degrades to a no-op rather than throwing on the hot path.
 */
export function documentHooks(app: HostApi): SessionHooks {
  return {
    words: () => {
      try {
        return app.editor.count({ countType: 'word' });
      } catch {
        return 0;
      }
    },
    wipe: () => {
      try {
        app.editor.setContent('', { resetHistory: true });
      } catch {
        /* no active editor; the run still ends as failed */
      }
    }
  };
}

/**
 * Arm the currently open document. Toasts and bails if no document is focused.
 * Returns whether a session was started.
 */
export function armDocument(app: HostApi): boolean {
  if (app.app.fileType !== 'document' || !app.app.fileId) {
    app.ui.toast(tr(app, STR.openDocFirst));
    return false;
  }
  const cfg = readConfig(app);
  cfg.startFileId = app.app.fileId;
  dwStore.start(cfg, documentHooks(app));
  app.ui.toast(tr(app, STR.docArmed));
  return true;
}
