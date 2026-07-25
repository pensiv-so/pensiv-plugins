import * as React from 'react';
import type { HostApi } from '@pensiv/plugin-sdk';
import { STR, tr, fmt } from './i18n';
import { formatElapsed } from './format';
import type { SessionStats } from './store';

/** The flame glyph for the live strip — the app's `Fire` (Lucide 1.5). */
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

/** Settings cog for the popover corner — the app's `Cog` (Lucide 1.5). */
export const CogIcon: React.FC<{ size?: string }> = ({ size = '1rem' }) => (
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
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export interface ResultCardProps {
  app: HostApi;
  status: 'success' | 'failed';
  stats: SessionStats | null;
  /** Effective fuse of the finished session, for the failure explanation. */
  fuseSec: number;
  /** Footer action buttons, composed by the caller. */
  children: React.ReactNode;
}

/**
 * The end-of-session result, in the contract's voice — the number talks:
 * "312 words burned." / "487 words survived." A one-line explanation and
 * right-aligned actions; the word count glows destructive on a burn.
 */
export const ResultCard: React.FC<ResultCardProps> = ({
  app,
  status,
  stats,
  fuseSec,
  children
}) => {
  const success = status === 'success';
  const count = fmt(tr(app, STR.nWords), { n: (stats?.words ?? 0).toLocaleString() });
  const title = tr(app, success ? STR.survivedTitle : STR.burnedTitle)
    .split(/(\{count\})/g)
    .map((part, i) =>
      part === '{count}' ? (
        <span className={success ? undefined : 'dw-hot'} key={i}>
          {count}
        </span>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    );
  const body = success
    ? fmt(tr(app, STR.survivedBody), { elapsed: formatElapsed(stats?.elapsedMs ?? 0) })
    : fmt(tr(app, STR.burnedBody), { fuse: String(fuseSec) });

  return (
    <div className="dw-dialog" role="alertdialog" aria-live="assertive">
      <h3 className="dw-dialog-title">{title}</h3>
      <p className="dw-dialog-desc">{body}</p>
      <div className="dw-dialog-foot">{children}</div>
    </div>
  );
};
