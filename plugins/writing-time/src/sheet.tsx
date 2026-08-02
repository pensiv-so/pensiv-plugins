import * as React from 'react';
import type { WidgetProps } from '@pensiv/plugin-sdk';
import {
  SheetActionRow,
  SheetGroup,
  SheetSeparator,
  SheetStack,
  SheetStatRow
} from '@pensiv/plugin-ui';
import { formatDuration, STR, tr } from './i18n';
import { goalPercent, targetMinutes, todaySafe, useActiveMs, useSessionChanges } from './session';

/**
 * Mobile **bottom-sheet body** (phone tray) and the desktop `openSheet` dialog
 * body. Composed from the host UI kit (`@pensiv/plugin-ui`) so it renders the
 * app's live sheet rows — identical to every native settings/stat sheet, and
 * theme-correct on every platform without a line of layout CSS here.
 */
const CogIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="1.25rem"
    height="1.25rem"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const WritingTimeSheet: React.FC<WidgetProps> = ({ app }) => {
  const { ms, writing } = useActiveMs(app);

  // Same live wiring as the card: session ticks re-read today's totals.
  useSessionChanges(app);
  const today = todaySafe(app);
  const minutes = targetMinutes(app);

  const rows = [
    { key: 'time', label: tr(app, STR.title), value: formatDuration(app, ms) },
    {
      key: 'status',
      label: tr(app, STR.status),
      value: writing ? tr(app, STR.writingNow) : tr(app, STR.idle)
    },
    { key: 'words', label: tr(app, STR.wordsToday), value: today.net.words.toLocaleString() },
    { key: 'chars', label: tr(app, STR.charsToday), value: today.net.chars.toLocaleString() },
    // Goal row only when a target is configured — a `0%` against nothing is noise.
    minutes > 0 && {
      key: 'goal',
      label: tr(app, STR.dailyGoal),
      value: `${formatDuration(app, minutes * 60_000)} · ${goalPercent(app, ms)}%`
    }
  ].filter(Boolean) as { key: string; label: string; value: string }[];

  return (
    <SheetStack>
      <SheetGroup>
        {rows.map((row, i) => (
          <React.Fragment key={row.key}>
            {i > 0 ? <SheetSeparator /> : null}
            <SheetStatRow label={row.label} value={row.value} />
          </React.Fragment>
        ))}
      </SheetGroup>

      <SheetGroup>
        <SheetActionRow
          icon={<CogIcon />}
          label={tr(app, STR.settings)}
          onClick={() => app.ui.openSettings()}
        />
      </SheetGroup>
    </SheetStack>
  );
};
