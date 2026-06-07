import * as React from 'react';
import type { HostApi } from '@pensiv/plugin-sdk';
import { STR, tr } from './i18n';
import { formatElapsed } from './format';
import type { SessionStats } from './store';

/** The flame glyph for the overlay status pill — the app's `Fire` (Lucide 1.5). */
export const FireIcon: React.FC<{ size?: string }> = ({ size = '1rem' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />
  </svg>
);

/** The stats line shown on a finished session ("X words · Ys"). */
const statsLine = (app: HostApi, stats: SessionStats | null): string => {
  if (!stats) return '';
  const words = `${stats.words.toLocaleString()} ${tr(app, STR.words)}`;
  return `${words} · ${formatElapsed(stats.elapsedMs)}`;
};

export interface ResultCardProps {
  app: HostApi;
  status: 'success' | 'failed';
  stats: SessionStats | null;
  /** Footer action buttons, composed by the caller. */
  children: React.ReactNode;
}

/**
 * The end-of-session result, styled as the app's `AlertDialog`: left-aligned
 * header (semibold title + muted description), a muted stats line, and a
 * right-aligned footer of action buttons. No emoji, no heavy weights, no color on
 * the title — it reads like every other alert in the app.
 */
export const ResultCard: React.FC<ResultCardProps> = ({ app, status, stats, children }) => {
  const success = status === 'success';
  return (
    <div className="dw-dialog" role="alertdialog" aria-live="assertive">
      <div className="dw-dialog-head">
        <h3 className="dw-dialog-title">{tr(app, success ? STR.survived : STR.wiped)}</h3>
        <p className="dw-dialog-desc">{tr(app, success ? STR.survivedBody : STR.wipedBody)}</p>
        {stats ? <p className="dw-dialog-detail">{statsLine(app, stats)}</p> : null}
      </div>
      <div className="dw-dialog-foot">{children}</div>
    </div>
  );
};
