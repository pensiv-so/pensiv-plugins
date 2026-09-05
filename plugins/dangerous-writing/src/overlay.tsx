import * as React from 'react';
import type { WidgetProps } from '@pensiv/plugin-sdk';
import { dwStore, useDangerStore } from './store';
import { armDocument } from './document';
import { installClipboardGuard } from './clipboard';
import { STR, tr } from './i18n';
import { formatClock, warnIntensity, warnThreshold } from './format';
import { ResultCard } from './components';
import { DangerLauncherPopover, recordFireAnchor } from './popover';

/**
 * The plugin's always-mounted surface (`frame: 'none'`, mounted by WidgetHost in
 * the project layout). It hosts two things:
 *   - the launcher popover, when `dwStore.popoverOpen` (opened by the
 *     document-header button) — this is why a document-header action can show a
 *     popover at all;
 *   - the full-screen danger drama while a session runs: a red wash that grows as
 *     the fuse burns, a top progress bar, a STRIP pill (flame · live count ·
 *     status · Stop — the launcher's one-line sibling), and the result card.
 * It also feeds editor keystrokes to the fuse and bails out safely if the user
 * navigates to a different file mid-session.
 */
export const DangerousWritingOverlay: React.FC<WidgetProps> = ({ app }) => {
  const store = useDangerStore();
  const active = store.status !== 'idle';
  const running = store.status === 'running';

  // Remember which pane's 🔥 button was clicked, so the popover anchors under the
  // right one in split view (capture-phase, fires before the action's onClick).
  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const btn = (e.target as Element | null)?.closest?.('button') as HTMLElement | null;
      if (btn && btn.querySelector('svg[aria-label="Fire icon"]')) recordFireAnchor(btn);
    };
    window.addEventListener('mousedown', onDown, true);
    return () => window.removeEventListener('mousedown', onDown, true);
  }, []);

  // Feed the real editor's keystrokes to the fuse while running.
  React.useEffect(() => {
    if (!running) return;
    let unsub = () => {};
    try {
      unsub = app.editor.on('update', () => dwStore.activity());
    } catch {
      /* no editor to subscribe to; the fuse simply won't be reset by typing */
    }
    return unsub;
  }, [running, app]);

  // Lock the clipboard for the run, per the armed session's own config — so
  // flipping the setting mid-session can't hand you an escape hatch you didn't
  // start with. Uninstalls the moment the session ends.
  const clipboardMode = store.config.clipboard;
  React.useEffect(() => {
    if (!running) return;
    return installClipboardGuard(app, clipboardMode);
  }, [running, app, clipboardMode]);

  // Safety: if the focused file changes out from under a running session, cancel
  // rather than risk wiping a document the user didn't arm.
  const fileId = app.app.fileId;
  React.useEffect(() => {
    if (running && store.config.startFileId && fileId && fileId !== store.config.startFileId) {
      dwStore.cancel();
    }
  }, [running, fileId, store.config.startFileId]);

  // Keep the popover mounted through its close animation, so it bounces out like
  // the native popover instead of vanishing (mirrors the Timer header).
  const [popMounted, setPopMounted] = React.useState(false);
  const [popClosing, setPopClosing] = React.useState(false);
  React.useEffect(() => {
    if (store.popoverOpen) {
      setPopMounted(true);
      setPopClosing(false);
    } else if (popMounted) {
      setPopClosing(true);
      const t = setTimeout(() => setPopMounted(false), 220);
      return () => clearTimeout(t);
    }
  }, [store.popoverOpen, popMounted]);

  if (!active && !popMounted) return null;

  const cfg = store.config;
  const danger = store.dangerLevel;
  const intensity = warnIntensity(danger, cfg.hardcore);
  const isDanger = danger > warnThreshold(cfg.hardcore);
  const ended = store.status === 'success' || store.status === 'failed';

  const progress =
    cfg.goalType === 'time'
      ? cfg.durationSec > 0
        ? 1 - store.remainingMs / (cfg.durationSec * 1000)
        : 0
      : cfg.wordTarget > 0
        ? store.progressWords / cfg.wordTarget
        : 0;
  const scaleX = Math.max(0, Math.min(1, progress));

  const liveLabel =
    cfg.goalType === 'time'
      ? formatClock(store.remainingMs)
      : `${store.progressWords.toLocaleString()} / ${cfg.wordTarget.toLocaleString()}`;
  const dangerMsg = danger > 0.85 ? STR.aboutToLose : isDanger ? STR.dontStop : STR.keepTyping;

  return (
    <div className="dw-overlay" aria-live="polite">
      {active ? (
        <>
          <div
            className="dw-overlay-wash"
            style={{ '--dw-wash': intensity.toFixed(3) } as React.CSSProperties}
          />
          {store.status === 'failed' ? <div className="dw-flash" /> : null}

          {running ? (
            <>
              <div
                className={`dw-overlay-top${isDanger ? ' is-danger' : ''}`}
                style={{ transform: `scaleX(${scaleX.toFixed(3)})` }}
              />
              {/* `no-drag` is the host app's utility (global.css). No flame, no
                  color shift — the full-screen red wash carries the danger; the
                  strip stays a calm, readable readout + Stop. */}
              <div className="dw-strip no-drag">
                <span className="dw-strip-live">{liveLabel}</span>
                <span className="dw-strip-msg">{tr(app, dangerMsg)}</span>
                <button className="dw-strip-stop no-drag" onClick={() => dwStore.cancel()}>
                  {tr(app, STR.stop)}
                </button>
              </div>
            </>
          ) : null}

          {ended ? (
            <div className="dw-banner-wrap">
              <div className="dw-banner">
                <ResultCard
                  app={app}
                  status={store.status === 'success' ? 'success' : 'failed'}
                  fuseSec={cfg.fuseSec}
                  stats={{
                    goalType: cfg.goalType,
                    words: store.progressWords,
                    elapsedMs:
                      store.endedAt && store.startedAt ? store.endedAt - store.startedAt : 0
                  }}
                >
                  <button className="dw-btn" onClick={() => dwStore.reset()}>
                    {tr(app, STR.done)}
                  </button>
                  {store.status === 'failed' ? (
                    <button className="dw-btn dw-btn--primary" onClick={() => armDocument(app)}>
                      {tr(app, STR.writeAgain)}
                    </button>
                  ) : null}
                </ResultCard>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {popMounted ? <DangerLauncherPopover app={app} closing={popClosing} /> : null}
    </div>
  );
};
