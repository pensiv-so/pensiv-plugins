import * as React from 'react';
import type { HostApi } from '@pensiv/plugin-sdk';
import { dwStore, useDangerStore } from './store';
import { armDocument } from './document';
import { readConfig } from './settings';
import { STR, tr } from './i18n';

const TIME_PRESETS = [5, 10, 20]; // minutes
const WORD_PRESETS = [250, 500, 1000];

/**
 * The exact toolbar button the user last clicked. In split view each pane has its
 * own 🔥 button, so a DOM query for "the Fire icon" is ambiguous — the overlay
 * records the clicked one here (capture-phase mousedown) so the popover anchors to
 * the right pane.
 */
let fireAnchor: HTMLElement | null = null;
export const recordFireAnchor = (el: HTMLElement | null): void => {
  fireAnchor = el;
};

/**
 * The launcher popover — opened by the document-header button (which toggles
 * `dwStore.popoverOpen`) and rendered by the always-mounted overlay widget, so it
 * works without an app-header render slot. Compact, icon-free, no backdrop blur;
 * the goal toggle + presets are the app's outline/ghost buttons (selected =
 * outline, rest = ghost).
 */
export const DangerLauncherPopover: React.FC<{ app: HostApi }> = ({ app }) => {
  const store = useDangerStore();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<HTMLElement | null>(null);
  const [coords, setCoords] = React.useState<{ top: number; right: number } | null>(null);

  React.useLayoutEffect(() => {
    // Prefer the button the user actually clicked (recorded by the overlay); fall
    // back to the first visible Fire button for non-pointer opens.
    let btn: HTMLElement | null =
      fireAnchor && fireAnchor.offsetParent !== null ? fireAnchor : null;
    if (!btn) {
      const icons = Array.from(document.querySelectorAll('svg[aria-label="Fire icon"]'));
      for (const el of icons) {
        const candidate = el.closest('button') as HTMLElement | null;
        if (candidate && candidate.offsetParent !== null) {
          btn = candidate;
          break;
        }
      }
    }
    anchorRef.current = btn;
    if (btn) {
      const r = btn.getBoundingClientRect();
      setCoords({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    } else {
      setCoords({ top: 52, right: 12 });
    }
  }, []);

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (contentRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      dwStore.setPopover(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dwStore.setPopover(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const running = store.status === 'running';
  const goalType = (app.storage.get<string>('goalType') ?? 'time') as 'time' | 'words';
  const durationSec = parseInt(app.storage.get<string>('durationSec') ?? '600', 10) || 600;
  const wordTarget = app.storage.get<number>('wordTarget') ?? 500;
  const live = readConfig(app);
  const docFocused = app.app.fileType === 'document' && !!app.app.fileId;

  const setGoalType = (t: 'time' | 'words') => {
    app.storage.set('goalType', t);
    dwStore.setPopover(true); // force a re-render through the store
  };
  const setTimePreset = (min: number) => {
    app.storage.set('durationSec', String(min * 60));
    dwStore.setPopover(true);
  };
  const setWordPreset = (n: number) => {
    app.storage.set('wordTarget', n);
    dwStore.setPopover(true);
  };

  const start = () => {
    if (armDocument(app)) dwStore.setPopover(false);
  };
  const stop = () => {
    dwStore.cancel();
    dwStore.setPopover(false);
  };

  /** Selected → outline, otherwise ghost (the app's button variants). */
  const seg = (on: boolean) => `dw-btn dw-btn--sm ${on ? 'dw-btn--outline' : 'dw-btn--ghost'}`;

  if (!coords) return null;

  return (
    <div
      ref={contentRef}
      className="dw-pop"
      role="dialog"
      aria-label={tr(app, STR.title)}
      style={{ top: coords.top, right: coords.right }}
    >
      <div className="dw-pop-head">
        <span className="dw-pop-name">{tr(app, STR.title)}</span>
        <button
          className="dw-pop-settings"
          onClick={() => {
            dwStore.setPopover(false);
            app.ui.openSettings();
          }}
        >
          {tr(app, STR.settings)}
        </button>
      </div>

      {running ? (
        <p className="dw-pop-note">{tr(app, STR.dontStop)}</p>
      ) : (
        <>
          <div className="dw-btnrow">
            <button className={seg(goalType === 'time')} onClick={() => setGoalType('time')}>
              {tr(app, STR.goalTime)}
            </button>
            <button className={seg(goalType === 'words')} onClick={() => setGoalType('words')}>
              {tr(app, STR.goalWords)}
            </button>
          </div>

          <div className="dw-btnrow">
            {goalType === 'time'
              ? TIME_PRESETS.map((m) => (
                  <button
                    key={m}
                    className={seg(durationSec === m * 60)}
                    onClick={() => setTimePreset(m)}
                  >
                    {m} {tr(app, STR.minutes)}
                  </button>
                ))
              : WORD_PRESETS.map((n) => (
                  <button
                    key={n}
                    className={seg(wordTarget === n)}
                    onClick={() => setWordPreset(n)}
                  >
                    {n.toLocaleString()}
                  </button>
                ))}
          </div>

          <div className="dw-pop-note">
            {tr(app, STR.fuseLabel)} {live.fuseSec}s
            {live.hardcore ? ` · ${tr(app, STR.hardcoreLabel)}` : ''}
          </div>
        </>
      )}

      {running ? (
        <div className="dw-btnrow">
          <button className="dw-btn dw-btn--sm dw-btn--outline" onClick={stop}>
            {tr(app, STR.stop)}
          </button>
        </div>
      ) : (
        <div className="dw-btnrow">
          <button
            className="dw-btn dw-btn--sm dw-btn--destructive"
            onClick={start}
            disabled={!docFocused}
          >
            {tr(app, STR.start)}
          </button>
        </div>
      )}
      {!running && !docFocused ? (
        <p className="dw-pop-note">{tr(app, STR.openDocToStart)}</p>
      ) : null}
    </div>
  );
};
