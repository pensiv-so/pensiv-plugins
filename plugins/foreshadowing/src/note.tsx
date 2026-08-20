/**
 * The note on a beat: "how I mean to pay this off".
 *
 * A beat's whole problem is that it is written now and settled fifty pages
 * later, by which time the plan behind it is gone. The note is that plan, kept
 * next to the sentence that needs it.
 *
 * ## It is a mark attribute, like everything else here
 *
 * The note could have been a `gid → text` map in `app.storage` — trivial to
 * write from anywhere, and wrong for two reasons. `app.storage` is *user*
 * settings, not project data, so the pruning that keeps the tick maps honest
 * (`pruneDone`) reconciles against the project that happens to be open; a map of
 * prose there would be one project switch away from being cleaned up. And the
 * note belongs to the sentence: it should travel with a cut-and-pasted
 * paragraph, land in version history, and die when the setup dies — which is
 * exactly what a mark does and a side table does not.
 *
 * ## The cost: only the active editor is writable
 *
 * `app.editor` is the editor the user is looking at, so a note on a beat in
 * another file cannot be written where it stands. {@link saveNote} pays that
 * cost explicitly — it opens the beat's file and writes once the host has it —
 * rather than the plugin pretending the save happened.
 */
import * as React from 'react';
import type { HostApi } from '@pensiv/plugin-sdk';
import { NOTE_MAX_LENGTH } from './mark';
import { createT } from './i18n';

/** Where a note is to be written, and how to get back to it. */
export interface NoteTarget {
  /** The setup anchor's id — the mark the note lives on. */
  fid: string;
  /** The file that mark is in. Omitted when it is by definition the active one. */
  fileId?: string;
  /** The span, so opening the file also lands on the sentence. */
  range?: { from: number; to: number };
}

/** Poll interval / ceiling while waiting for a freshly-opened editor. ~3s. */
const SETTLE_MS = 120;
const SETTLE_TRIES = 25;

/**
 * Patch the note onto the mark in the *active* editor. `false` when there is no
 * active editor, when its schema has no foreshadow mark (a continuous folder
 * view), or when the fid isn't in this document — all of which are "not yet, or
 * not here", never "saved".
 */
function applyNote(app: HostApi, fid: string, note: string): boolean {
  try {
    return app.editor.runCommand('updateForeshadowAnchor', fid, { note });
  } catch {
    // A disabled plugin's gated calls throw; a half-written note is not worth
    // taking the host down for.
    return false;
  }
}

/**
 * Write `note` onto `target`, opening its file first when it isn't the one on
 * screen. `openFile` is fire-and-forget, so the write is retried until the host
 * reports that file as active and the command actually lands — and gives up
 * loudly rather than silently dropping what the writer typed.
 */
export function saveNote(app: HostApi, target: NoteTarget, note: string): void {
  const t = createT(app);
  const value = note.trim().slice(0, NOTE_MAX_LENGTH);
  const finish = (ok: boolean) => app.ui.toast(t(ok ? 'noteSaved' : 'noteFailed'));

  if (!target.fileId || app.app.fileId === target.fileId) {
    finish(applyNote(app, target.fid, value));
    return;
  }

  app.ui.openFile(target.fileId, target.range ? { range: target.range } : undefined);

  let tries = 0;
  const attempt = () => {
    if (app.app.fileId === target.fileId && applyNote(app, target.fid, value)) {
      finish(true);
      return;
    }
    if (++tries >= SETTLE_TRIES) {
      finish(false);
      return;
    }
    app.platform.timer(SETTLE_MS, attempt);
  };
  app.platform.timer(SETTLE_MS, attempt);
}

export interface NoteEditorProps {
  app: HostApi;
  /** The marked sentence, for context — the note is *about* this. */
  quote: string;
  /** What is already written down. */
  note: string;
  /** Set when saving will navigate: the title of the file the beat is in. */
  remoteTitle?: string;
  onSave: (note: string) => void;
  onCancel: () => void;
}

/**
 * The sheet body: the sentence, a textarea, two buttons. The host draws the
 * chrome. `⌘/Ctrl+Enter` saves — the note is prose and Enter belongs to it.
 */
export const NoteEditor: React.FC<NoteEditorProps> = ({
  app,
  quote,
  note,
  remoteTitle,
  onSave,
  onCancel
}) => {
  const t = React.useMemo(() => createT(app), [app]);
  const [value, setValue] = React.useState(note);
  const ref = React.useRef<HTMLTextAreaElement | null>(null);

  // Straight into typing: the sheet is opened *to* write a note, so anything
  // else is a keystroke the writer has to spend before saying the thing.
  React.useEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, []);

  return (
    <div className="pnsv-fs" data-variant="sheet">
      {quote.trim() ? <p className="pnsv-fs-quote">{quote.trim()}</p> : null}
      <textarea
        ref={ref}
        className="pnsv-fs-note-input"
        value={value}
        rows={4}
        maxLength={NOTE_MAX_LENGTH}
        placeholder={t('notePlaceholder')}
        aria-label={t('noteTitle')}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onSave(value);
          }
        }}
      />
      {remoteTitle ? <p className="pnsv-fs-hint">{t('noteRemoteHint')}</p> : null}
      <div className="pnsv-fs-actions">
        <button type="button" className="pnsv-fs-btn" onClick={onCancel}>
          {t('cancel')}
        </button>
        <button
          type="button"
          className="pnsv-fs-btn"
          data-variant="primary"
          onClick={() => onSave(value)}
        >
          {t('save')}
        </button>
      </div>
    </div>
  );
};

/**
 * Open the editor for one beat. Shared by the two places a note is written: the
 * list row's button, and planting (where the file is the active one, so there is
 * no `fileId` to navigate to).
 */
export function openNoteSheet(
  app: HostApi,
  target: NoteTarget,
  options: { quote: string; note: string; remoteTitle?: string }
): void {
  const t = createT(app);
  app.ui.openSheet(
    <NoteEditor
      app={app}
      quote={options.quote}
      note={options.note}
      remoteTitle={options.remoteTitle}
      onSave={(next) => {
        // Close first: saving a remote note navigates, and a dialog left up
        // over the arriving document reads as a second, stuck sheet.
        app.ui.closeSheet();
        saveNote(app, target, next);
      }}
      onCancel={() => app.ui.closeSheet()}
    />,
    { title: t('noteTitle') }
  );
}
