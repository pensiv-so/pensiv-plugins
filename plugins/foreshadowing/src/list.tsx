/**
 * The list of beats — one component, four homes: the project tab, the document
 * side pane, the plugin's settings page, and a host sheet.
 *
 * ## Looking native
 *
 * Every value here is the app's own, re-stated in `styles.css` (the app's
 * Tailwind build never scans this repo, so the classes can't be imported):
 *
 *  - the **row** is the task row — 1.125rem checkbox at the app's rounded-sm
 *    (`calc(var(--radius) - 0.1rem)`, not 2px), `gap-3`, `rounded-lg`,
 *    `px-3 py-2`, hover fill, title that goes muted + struck when done inside an
 *    `opacity-60` body, one muted detail line under it;
 *  - the **tab strip** is the notes pane's — underline, own row, project first;
 *  - **two type sizes per home, both the app's**: panes at text-sm/text-xs, the
 *    settings card at the settings scale around it (text-md/text-sm). The
 *    percentage is emphasised with weight, not size;
 *  - **one alignment line.** Tab labels, the summary, section headings and the
 *    checkboxes all start at the same inset, so nothing looks hand-placed.
 *
 * ## One payoff path
 *
 * Paying off starts from the prose, not the list: select the landing sentence,
 * press "Pay off foreshadowing" in the toolbar, pick the beat in the
 * {@link PayoffPicker} sheet. The rows here carry no payoff affordance — their
 * checkbox is the manual override (both directions), and clicking a row
 * navigates to the setup sentence.
 */
import * as React from 'react';
import type { HostApi } from '@pensiv/plugin-sdk';
import { summarize, threadLabel, threadNote, type Thread } from './anchors';
import { scanProject, threadsInFile } from './scan';
import { openNoteSheet } from './note';
import {
  markThreadDeleted,
  pruneDeleted,
  pruneDone,
  readSettings,
  setDoneByHand,
  setReopenedByHand
} from './store';
import { createT } from './i18n';

/** Coalesce the burst of events a single keystroke or save produces. */
const RESCAN_DEBOUNCE_MS = 300;

type Scope = 'project' | 'file';

export interface ForeshadowListProps {
  app: HostApi;
  /** The file in view; adds the "this file" tab. */
  fileId?: string;
  /** Where it is drawn. Chrome only — the data is the same everywhere. */
  variant?: 'pane' | 'sheet' | 'settings';
}

/**
 * Re-scan on anything that could change the answer: the text (the marks live in
 * it), project data (a file renamed, added, trashed), and this plugin's storage
 * (a tick made in another pane or on another device).
 */
function useScan(app: HostApi): ReturnType<typeof scanProject> {
  const [scan, setScan] = React.useState(() => scanProject(app));

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const rescan = () => {
      if (disposed) return;
      const next = scanProject(app);
      setScan(next);
      // Reconcile storage against what actually exists: overrides for beats
      // whose text is gone, and tombstones whose marks are all swept.
      pruneDone(app, new Set(next.threads.map((thread) => thread.gid)));
      pruneDeleted(app, next.markGids);
      // Deleted beats can leave marks in files that weren't active at delete
      // time; strip them from the file the writer is looking at now. Triggers
      // an editor update, which re-runs this scan once, clean.
      if (next.staleActiveGids.length > 0) {
        app.editor.runCommand('removeForeshadowByGids', next.staleActiveGids);
      }
    };

    const schedule = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(rescan, RESCAN_DEBOUNCE_MS);
    };

    const unsubscribes = [
      app.editor.on('update', schedule),
      app.project.subscribe(schedule, ['files']),
      app.storage.on('doneThreads', schedule),
      app.storage.on('reopenedThreads', schedule),
      app.storage.on('deletedThreads', schedule),
      app.storage.on('includeSheets', schedule)
    ];

    rescan();

    return () => {
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [app]);

  return scan;
}

/** The app's checkbox, re-stated: 1.125rem box, primary fill, lucide check. */
const Check: React.FC<{
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}> = ({ checked, label, onChange }) => (
  <span className="pnsv-fs-check" data-checked={checked ? 'true' : undefined}>
    <input
      type="checkbox"
      checked={checked}
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.checked)}
    />
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d="M20 6 9 17l-5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

const Row: React.FC<{
  thread: Thread;
  detail: string;
  strike: boolean;
  noteLabel: string;
  deleteLabel: string;
  onToggle: (next: boolean) => void;
  onNote: () => void;
  onDelete: () => void;
  onOpen: () => void;
}> = ({ thread, detail, strike, noteLabel, deleteLabel, onToggle, onNote, onDelete, onOpen }) => {
  const note = threadNote(thread);
  return (
    <div
      className="pnsv-fs-row"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <Check checked={thread.resolved} label={threadLabel(thread)} onChange={onToggle} />
      <span className="pnsv-fs-body" data-done={thread.resolved ? 'true' : undefined}>
        <span className="pnsv-fs-line">
          <span
            className="pnsv-fs-title"
            data-strike={strike && thread.resolved ? 'true' : undefined}
          >
            {threadLabel(thread)}
          </span>
          {detail ? <span className="pnsv-fs-detail">{detail}</span> : null}
        </span>
        {/* The reason the row exists twenty chapters later: the plan, in full
            enough to act on, clamped so one long note can't own the pane. */}
        {note ? <span className="pnsv-fs-note">{note}</span> : null}
      </span>
      {/* Hover-revealed, like the task row's own actions; always visible on touch. */}
      <button
        type="button"
        className="pnsv-fs-action"
        title={noteLabel}
        aria-label={noteLabel}
        onClick={(event) => {
          event.stopPropagation();
          onNote();
        }}
      >
        {/* lucide message-square-text */}
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM13 8H7m10 4H7"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        className="pnsv-fs-action"
        data-tone="destructive"
        title={deleteLabel}
        aria-label={deleteLabel}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        {/* lucide trash-2 */}
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m5 5v6m4-6v6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
};

export const ForeshadowList: React.FC<ForeshadowListProps> = ({
  app,
  fileId,
  variant = 'pane'
}) => {
  const t = React.useMemo(() => createT(app), [app]);
  const { threads, titles } = useScan(app);
  // Beats are a manuscript-wide debt, not a per-file one, so the project is
  // always the default scope — the file tab is the narrowing, not the base case.
  const [scope, setScope] = React.useState<Scope>('project');
  const showTabs = variant === 'pane' && !!fileId;

  const scoped = React.useMemo(() => {
    if (scope === 'file' && fileId) return threadsInFile(threads, fileId);
    return [...threads].sort((a, b) => {
      const byFile = (titles.get(a.setup.fileId) ?? '').localeCompare(
        titles.get(b.setup.fileId) ?? ''
      );
      return byFile !== 0 ? byFile : a.setup.from - b.setup.from;
    });
  }, [threads, titles, scope, fileId]);

  const stats = summarize(scoped);
  const strike = readSettings(app).strikeResolved;
  const open = scoped.filter((thread) => !thread.resolved);
  const resolved = scoped.filter((thread) => thread.resolved);

  /**
   * Delete = tombstone (hides it everywhere, synced) + strip the marks the
   * active editor can reach right now; marks in other files are swept when
   * those files next become active. The text itself is never touched.
   */
  const deleteThread = (thread: Thread) => {
    markThreadDeleted(app, thread.gid);
    app.editor.runCommand('removeForeshadowByGids', [thread.gid]);
    app.ui.toast(t('deleted'));
  };

  /**
   * The note is a mark in the beat's own file, and only the active editor is
   * writable — so a note on a beat elsewhere navigates on save (the hint in the
   * sheet says so, and `saveNote` does the opening).
   */
  const editNote = (thread: Thread) => {
    const setup = thread.setup;
    const remote = setup.fileId !== app.app.fileId;
    openNoteSheet(
      app,
      { fid: setup.fid, fileId: setup.fileId, range: { from: setup.from, to: setup.to } },
      {
        quote: setup.quote,
        note: setup.note,
        remoteTitle: remote ? (titles.get(setup.fileId) ?? '') : undefined
      }
    );
  };

  const renderRow = (thread: Thread) => (
    <Row
      key={thread.gid}
      thread={thread}
      detail={[
        scope === 'project' ? titles.get(thread.setup.fileId) : null,
        thread.payoffs.length > 0 ? `${thread.payoffs.length} ${t('payoffCount')}` : null,
        thread.resolvedByHand ? t('byHand') : null
      ]
        .filter(Boolean)
        .join(' · ')}
      strike={strike}
      noteLabel={threadNote(thread) ? t('editNote') : t('addNote')}
      deleteLabel={t('deleteBeat')}
      // Both directions, without touching the prose: a beat with payoff marks
      // toggles via the reopened override, one without via the manual tick.
      onToggle={(next) =>
        thread.payoffs.length > 0
          ? setReopenedByHand(app, thread.gid, !next)
          : setDoneByHand(app, thread.gid, next)
      }
      onNote={() => editNote(thread)}
      onDelete={() => deleteThread(thread)}
      onOpen={() =>
        app.ui.openFile(thread.setup.fileId, {
          range: { from: thread.setup.from, to: thread.setup.to }
        })
      }
    />
  );

  const body = (
    <>
      {showTabs ? (
        <div className="pnsv-fs-tabs" role="tablist">
          {(['project', 'file'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={scope === value}
              className="pnsv-fs-tab"
              data-active={scope === value}
              onClick={() => setScope(value)}
            >
              {value === 'project' ? t('project') : t('thisFile')}
            </button>
          ))}
        </div>
      ) : null}

      {scoped.length === 0 ? (
        // The notes pane's empty state — centered in the pane, quiet — with the
        // plugin's icon and one hint line. A "0% · 0/0" header over nothing is
        // a stat about nothing, so the summary only renders with the list.
        <div className="pnsv-fs-blank">
          <svg viewBox="0 0 24 24" aria-hidden focusable="false">
            <path
              d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="pnsv-fs-blank-title">{t('emptyTitle')}</p>
          <p className="pnsv-fs-blank-hint">{t('emptyHint')}</p>
        </div>
      ) : (
        <>
          <div className="pnsv-fs-summary">
            <span className="pnsv-fs-summary-line">
              <span className="pnsv-fs-rate">{Math.round(stats.rate * 100)}%</span>
              <span>
                {t('rate')} · {stats.resolved}/{stats.total}
              </span>
            </span>
            <span
              className="pnsv-fs-bar"
              role="progressbar"
              aria-valuenow={Math.round(stats.rate * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span className="pnsv-fs-bar-fill" style={{ width: `${stats.rate * 100}%` }} />
            </span>
          </div>

          <div className="pnsv-fs-list">
            {open.length > 0 ? (
              <>
                <p className="pnsv-fs-section">
                  {t('open')} · {open.length}
                </p>
                {open.map(renderRow)}
              </>
            ) : (
              <p className="pnsv-fs-empty">{t('emptyOpen')}</p>
            )}

            {resolved.length > 0 ? (
              <>
                <p className="pnsv-fs-section">
                  {t('resolved')} · {resolved.length}
                </p>
                {resolved.map(renderRow)}
              </>
            ) : null}
          </div>
        </>
      )}
    </>
  );

  // On the settings page the section has to sit in a card like every other
  // setting: the app's muted frame around an elevated card (`SettingsCard`).
  if (variant === 'settings') {
    return (
      <section className="pnsv-fs-card">
        <div className="pnsv-fs-card-inner">
          <div className="pnsv-fs" data-variant="settings">
            {body}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="pnsv-fs" data-variant={variant}>
      {body}
    </div>
  );
};

/**
 * The payoff picker, shown in a host sheet (`app.ui.openSheet`) from the editor
 * surfaces: the writer has just selected the sentence that lands a beat, and
 * picks *which* beat here. The host draws the chrome (title, close); this is
 * only the body — the selected sentence for confidence, one hint line, then the
 * open beats as task-style rows. Picking a row anchors the payoff and closes
 * the sheet in one gesture.
 */
export const PayoffPicker: React.FC<{
  app: HostApi;
  /** The selected text the payoff will be anchored to. */
  quote: string;
  /** Open threads only — a resolved beat is not a target. */
  threads: readonly Thread[];
  /** File id → title, for the row's secondary line. */
  titles: ReadonlyMap<string, string>;
  onPick: (thread: Thread) => void;
}> = ({ app, quote, threads, titles, onPick }) => {
  const t = React.useMemo(() => createT(app), [app]);
  return (
    <div className="pnsv-fs" data-variant="sheet">
      {quote.trim() ? <p className="pnsv-fs-quote">{quote.trim()}</p> : null}
      <p className="pnsv-fs-hint">{t('pickHint')}</p>
      <div className="pnsv-fs-list">
        <p className="pnsv-fs-section">
          {t('open')} · {threads.length}
        </p>
        {threads.map((thread) => (
          <button
            key={thread.gid}
            type="button"
            className="pnsv-fs-row"
            onClick={() => onPick(thread)}
          >
            <span className="pnsv-fs-body">
              <span className="pnsv-fs-line">
                <span className="pnsv-fs-title">{threadLabel(thread)}</span>
                {titles.get(thread.setup.fileId) ? (
                  <span className="pnsv-fs-detail">{titles.get(thread.setup.fileId)}</span>
                ) : null}
              </span>
              {/* Two beats can quote near-identical sentences; the note is what
                  tells them apart at the moment of choosing. */}
              {threadNote(thread) ? (
                <span className="pnsv-fs-note" data-lines="1">
                  {threadNote(thread)}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
