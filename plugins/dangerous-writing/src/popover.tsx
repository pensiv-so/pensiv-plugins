import * as React from 'react';
import type { HostApi } from '@pensiv/plugin-sdk';
import { dwStore, useDangerStore } from './store';
import { armDocument } from './document';
import { readConfig } from './settings';
import { STR, tr } from './i18n';
import { formatClock } from './format';
import { CogIcon, FireIcon } from './components';

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
 * works without an app-header render slot. A blurred, hairline-ringed card
 * matching the app's popover: the goal type + preset are segmented controls, and
 * arming is the single destructive accent. `closing` plays the bounce-out.
 */
export const DangerLauncherPopover: React.FC<{ app: HostApi; closing?: boolean }> = ({
  app,
  closing
}) => {
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

  if (!coords) return null;

  return (
    <div
      ref={contentRef}
      className={`dw-pop${closing ? ' closing' : ''}`}
      role="dialog"
      aria-label={tr(app, STR.title)}
      style={{ top: coords.top, right: coords.right }}
    >
      <div className="dw-pop-head">
        <span className="dw-pop-icon">
          <FireIcon size="0.875rem" />
        </span>
        <span className="dw-pop-title">{tr(app, STR.title)}</span>
        <button
          className="dw-cog"
          title={tr(app, STR.settings)}
          aria-label={tr(app, STR.settings)}
          onClick={() => {
            dwStore.setPopover(false);
            app.ui.openSettings();
          }}
        >
          <CogIcon />
        </button>
      </div>

      {running ? (
        <>
          <p className="dw-pop-note">{tr(app, STR.dontStop)}</p>
          <button className="dw-btn dw-btn--block" onClick={stop}>
            {tr(app, STR.stop)}
          </button>
        </>
      ) : (
        <>
          <div className="dw-seg-row" role="tablist" aria-label={tr(app, STR.goalLabel)}>
            <button
              className="dw-seg"
              role="tab"
              aria-selected={goalType === 'time'}
              data-on={goalType === 'time'}
              onClick={() => setGoalType('time')}
            >
              {tr(app, STR.goalTime)}
            </button>
            <button
              className="dw-seg"
              role="tab"
              aria-selected={goalType === 'words'}
              data-on={goalType === 'words'}
              onClick={() => setGoalType('words')}
            >
              {tr(app, STR.goalWords)}
            </button>
          </div>

          <div className="dw-focal">
            <div className="dw-focal-value">
              {goalType === 'time'
                ? formatClock(durationSec * 1000)
                : wordTarget.toLocaleString()}
            </div>
            <div className="dw-focal-label">
              {goalType === 'time' ? tr(app, STR.focalTime) : tr(app, STR.words)}
            </div>
          </div>

          <div className="dw-seg-row">
            {goalType === 'time'
              ? TIME_PRESETS.map((m) => (
                  <button
                    key={m}
                    className="dw-seg"
                    data-on={durationSec === m * 60}
                    onClick={() => setTimePreset(m)}
                  >
                    {m} {tr(app, STR.minutes)}
                  </button>
                ))
              : WORD_PRESETS.map((n) => (
                  <button
                    key={n}
                    className="dw-seg"
                    data-on={wordTarget === n}
                    onClick={() => setWordPreset(n)}
                  >
                    {n.toLocaleString()}
                  </button>
                ))}
          </div>

          <button
            className="dw-btn dw-btn--danger dw-btn--block"
            onClick={start}
            disabled={!docFocused}
          >
            {tr(app, STR.start)}
          </button>

          {docFocused ? (
            <div className="dw-pop-meta">
              {tr(app, STR.fuseLabel)} {live.fuseSec}s
              {live.hardcore ? ` · ${tr(app, STR.hardcoreLabel)}` : ''}
            </div>
          ) : (
            <p className="dw-pop-note">{tr(app, STR.openDocToStart)}</p>
          )}
        </>
      )}
    </div>
  );
};
