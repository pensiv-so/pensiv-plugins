import * as React from 'react';
import type { HostApi } from '@pensiv/plugin-sdk';
import { dwStore, useDangerStore } from './store';
import { armDocument } from './document';
import { readConfig } from './settings';
import { STR, tr, fmt } from './i18n';
import { formatClock } from './format';
import { CogIcon } from './components';

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

type MenuId = 'goal' | 'fuse';

/**
 * The launcher popover — a CONTRACT, not a settings form. One sentence states
 * the dare ("Write for 10 minutes without pausing longer than 5 seconds — or
 * everything burns."); the goal and fuse are inline red tokens that open small
 * value menus (time and word goals share one menu, so there is no separate
 * goal-type switch). One red button signs it. While running, the sentence
 * becomes the live status and the button becomes a safe outline Stop.
 * Rendered by the always-mounted overlay widget; `closing` plays the bounce-out.
 */
export const DangerLauncherPopover: React.FC<{ app: HostApi; closing?: boolean }> = ({
  app,
  closing
}) => {
  const store = useDangerStore();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<HTMLElement | null>(null);
  const [coords, setCoords] = React.useState<{ top: number; right: number } | null>(null);
  const [menu, setMenu] = React.useState<MenuId | null>(null);

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // First Escape closes an open token menu, the second closes the popover.
      setMenu((m) => {
        if (m) return null;
        dwStore.setPopover(false);
        return null;
      });
    };
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

  const pickTime = (min: number) => {
    app.storage.set('goalType', 'time');
    app.storage.set('durationSec', String(min * 60));
    setMenu(null);
  };
  const pickWords = (n: number) => {
    app.storage.set('goalType', 'words');
    app.storage.set('wordTarget', n);
    setMenu(null);
  };
  const pickFuse = (sec: number) => {
    app.storage.set('fuseSec', sec);
    setMenu(null);
  };

  const start = () => {
    if (armDocument(app)) dwStore.setPopover(false);
  };
  const stop = () => {
    dwStore.cancel();
    dwStore.setPopover(false);
  };

  if (!coords) return null;

  // ── The contract sentence, tokens spliced in at the language's word order ──
  const goalLabel =
    goalType === 'time'
      ? fmt(tr(app, STR.nMinutes), { n: String(Math.round(durationSec / 60)) })
      : fmt(tr(app, STR.nWords), { n: wordTarget.toLocaleString() });
  // Show the EFFECTIVE fuse (hardcore-adjusted) — the sentence must tell the
  // truth about what actually burns the page.
  const fuseLabel = fmt(tr(app, STR.nSeconds), { n: String(live.fuseSec) });

  const token = (id: MenuId, label: string, menuBody: React.ReactNode) => (
    <span className="dw-tokwrap" key={id}>
      <button
        className="dw-tok"
        data-open={menu === id}
        onClick={() => setMenu((m) => (m === id ? null : id))}
      >
        {label}
      </button>
      {menu === id ? <span className="dw-menu">{menuBody}</span> : null}
    </span>
  );

  const goalMenu = (
    <>
      {TIME_PRESETS.map((m) => (
        <button
          key={`t${m}`}
          className="dw-menu-item"
          data-on={goalType === 'time' && durationSec === m * 60}
          onClick={() => pickTime(m)}
        >
          {fmt(tr(app, STR.nMinutes), { n: String(m) })}
        </button>
      ))}
      <span className="dw-menu-sep" />
      {WORD_PRESETS.map((n) => (
        <button
          key={`w${n}`}
          className="dw-menu-item"
          data-on={goalType === 'words' && wordTarget === n}
          onClick={() => pickWords(n)}
        >
          {fmt(tr(app, STR.nWords), { n: n.toLocaleString() })}
        </button>
      ))}
    </>
  );
  const fuseMenu = (
    <>
      {[3, 5, 7, 10].map((s) => (
        <button
          key={s}
          className="dw-menu-item"
          data-on={(app.storage.get<number>('fuseSec') ?? 5) === s}
          onClick={() => pickFuse(s)}
        >
          {fmt(tr(app, STR.nSeconds), { n: String(s) })}
        </button>
      ))}
    </>
  );

  const contract = tr(app, goalType === 'time' ? STR.contractTime : STR.contractWords)
    .split(/(\{goal\}|\{fuse\})/g)
    .map((part, i) => {
      if (part === '{goal}') return token('goal', goalLabel, goalMenu);
      if (part === '{fuse}') return token('fuse', fuseLabel, fuseMenu);
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });

  // ── The live status sentence while running ──
  const cfg = store.config;
  const leftLabel =
    cfg.goalType === 'time'
      ? formatClock(store.remainingMs)
      : fmt(tr(app, STR.nWords), {
          n: Math.max(0, cfg.wordTarget - store.progressWords).toLocaleString()
        });
  const runSentence = tr(app, cfg.goalType === 'time' ? STR.runTime : STR.runWords)
    .split(/(\{left\})/g)
    .map((part, i) =>
      part === '{left}' ? (
        <span className="dw-live" key={i}>
          {leftLabel}
        </span>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    );

  return (
    <div
      ref={contentRef}
      className={`dw-pop${closing ? ' closing' : ''}`}
      role="dialog"
      aria-label={tr(app, STR.title)}
      style={{ top: coords.top, right: coords.right }}
      onMouseDownCapture={(e) => {
        // A click anywhere in the card that isn't a token or its menu closes the menu.
        if (menu && !(e.target as Element).closest?.('.dw-tokwrap')) setMenu(null);
      }}
    >
      <button
        className="dw-cog"
        title={tr(app, STR.settings)}
        aria-label={tr(app, STR.settings)}
        onClick={() => {
          dwStore.setPopover(false);
          app.ui.openSettings();
        }}
      >
        <CogIcon size="0.9375rem" />
      </button>

      {running ? (
        <>
          <div className="dw-contract">{runSentence}</div>
          <button className="dw-btn dw-btn--outline dw-btn--tall dw-btn--block" onClick={stop}>
            {tr(app, STR.stop)}
          </button>
        </>
      ) : (
        <>
          <div className="dw-contract">{contract}</div>
          <button
            className="dw-btn dw-btn--primary dw-btn--tall dw-btn--block"
            onClick={start}
            disabled={!docFocused}
          >
            {tr(app, STR.start)}
          </button>
          {!docFocused ? <p className="dw-note">{tr(app, STR.openDocToStart)}</p> : null}
        </>
      )}
    </div>
  );
};
