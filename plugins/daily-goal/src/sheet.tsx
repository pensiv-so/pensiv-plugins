import * as React from 'react';
import {
  resolveLocalizedText,
  type HostApi,
  type LocalizedText,
  type WidgetProps
} from '@pensiv/plugin-sdk';
import {
  SheetActionRow,
  SheetGroup,
  SheetSeparator,
  SheetStack,
  SheetStatRow
} from '@pensiv/plugin-ui';
import { confettiBurst } from './confetti';
import { sessionTodaySafe } from './main';

/**
 * Mobile **bottom-sheet body** for the daily goal (phone tray). Composed from the
 * host UI kit (`@pensiv/plugin-ui`) so it stays visually identical to every other
 * plugin sheet, and mirrors the native `ProjectPaneDailyGoalBottomSheet`: stat
 * rows (respecting the show-total / show-added / show-removed toggles) + a
 * settings action. Wired to the plugin's `app.session` + `app.storage`.
 */
const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });
const tr = (app: HostApi, t: LocalizedText) => resolveLocalizedText(t, app.app.locale);

const STR = {
  total: L('Total', '합계', '合計'),
  words: L('Words', '단어', '言葉'),
  chars: L('Chars', '글자', '文字'),
  addedToday: L('Added today', '오늘 입력', '今日追加'),
  removedToday: L('Removed today', '오늘 지움', '今日削除'),
  settings: L('Daily goal settings', '일일 목표 설정', '毎日の目標設定')
};

const CogIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="1.25rem"
    height="1.25rem"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const DailyGoalSheet: React.FC<WidgetProps> = ({ app }) => {
  const type = (app.storage.get<string>('type') ?? 'words') as 'words' | 'characters';
  const target = app.storage.get<number>('target') ?? 1000;
  const showTotal = app.storage.get<boolean>('showTotal') ?? true;
  const showAdded = app.storage.get<boolean>('showAdded') ?? true;
  const showRemoved = app.storage.get<boolean>('showRemoved') ?? true;
  const unit = type === 'words' ? tr(app, STR.words) : tr(app, STR.chars);

  // Derived in render from live settings + session; `change` drives session ticks.
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => app.session.on('change', bump), [app]);
  const totals = sessionTodaySafe(app);

  const pick = (p: { words: number; chars: number }) => (type === 'words' ? p.words : p.chars);
  const current = pick(totals.net);
  const achieved = target > 0 && current >= target;

  // Confetti once per day, persisted — mirrors the widget so phone & tablet
  // celebrate the same way and a reload doesn't re-fire it.
  const today = new Date().toISOString().slice(0, 10);
  const prevAchieved = React.useRef<boolean | null>(null);
  React.useEffect(() => {
    if (prevAchieved.current === null) {
      prevAchieved.current = achieved;
      return;
    }
    if (achieved && !prevAchieved.current && app.storage.get<string>('celebratedOn') !== today) {
      confettiBurst({ particleCount: 50, spread: 55, angle: 90, origin: { x: 0.5, y: 0.35 } });
      app.storage.set('celebratedOn', today);
    }
    prevAchieved.current = achieved;
  }, [achieved]);

  const rows = [
    showTotal && {
      key: 'total',
      label: `${tr(app, STR.total)} ${unit}`,
      value: `${current.toLocaleString()} / ${target.toLocaleString()}`
    },
    showAdded && {
      key: 'added',
      label: tr(app, STR.addedToday),
      value: pick(totals.added).toLocaleString()
    },
    showRemoved && {
      key: 'removed',
      label: tr(app, STR.removedToday),
      value: pick(totals.removed).toLocaleString()
    }
  ].filter(Boolean) as { key: string; label: string; value: string }[];

  return (
    <SheetStack>
      {rows.length > 0 ? (
        <SheetGroup>
          {rows.map((row, i) => (
            <React.Fragment key={row.key}>
              {i > 0 ? <SheetSeparator /> : null}
              <SheetStatRow label={row.label} value={row.value} />
            </React.Fragment>
          ))}
        </SheetGroup>
      ) : null}

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
