import * as React from 'react';
import { useEffect, useReducer } from 'react';
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
import { confettiBurst, confettiConfigForCorner, readWidgetCorner } from './confetti';
import { measureSafe } from './main';

const WIDGET_STORAGE_KEY = 'pensiv:document-goal:corner';

/**
 * Mobile **bottom-sheet body** for the document goal (phone tray). Composed from
 * the host UI kit (`@pensiv/plugin-ui`) so it matches every other plugin sheet,
 * and mirrors the native `ProjectPaneDocumentGoalBottomSheet`: Total / Target
 * stat rows + a settings action. Wired to the plugin's `app.editor` counting.
 */
const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });
const tr = (app: HostApi, t: LocalizedText) => resolveLocalizedText(t, app.app.locale);

const STR = {
  total: L('Total', '합계', '合計'),
  target: L('Target', '목표', 'ターゲット'),
  words: L('Words', '단어', '言葉'),
  chars: L('Chars', '글자', '文字'),
  settings: L('Document goal settings', '문서 목표 설정', '文書目標の設定')
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

export const DocumentGoalSheet: React.FC<WidgetProps> = ({ app }) => {
  const type = (app.storage.get<string>('type') ?? 'words') as 'words' | 'characters';
  const target = app.storage.get<number>('target') ?? 5000;
  const unit = type === 'words' ? tr(app, STR.words) : tr(app, STR.chars);
  const fileId = app.app.fileId;

  // Derived in render from live settings + content; `update` drives content ticks.
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => app.editor.on('update', bump), [app]);
  const count = measureSafe(app, type);

  const achieved = target > 0 && count >= target;

  // Confetti once per document, persisted — mirrors the widget.
  const prevAchieved = React.useRef<boolean | null>(null);
  const prevFileId = React.useRef<string | undefined>(fileId);
  useEffect(() => {
    if (prevFileId.current !== fileId) {
      prevAchieved.current = null;
      prevFileId.current = fileId;
    }
    if (prevAchieved.current === null) {
      prevAchieved.current = achieved;
      return;
    }
    const celebrated = app.storage.get<Record<string, boolean>>('celebratedDocs') ?? {};
    const already = fileId ? celebrated[fileId] === true : true;
    if (achieved && !prevAchieved.current && !already && fileId) {
      const cfg = confettiConfigForCorner(readWidgetCorner(WIDGET_STORAGE_KEY));
      confettiBurst({ particleCount: 50, spread: 55, angle: cfg.angle, origin: cfg.origin });
      app.storage.set('celebratedDocs', { ...celebrated, [fileId]: true });
    }
    prevAchieved.current = achieved;
  }, [achieved, fileId]);

  return (
    <SheetStack>
      <SheetGroup>
        <SheetStatRow label={`${tr(app, STR.total)} ${unit}`} value={count.toLocaleString()} />
        <SheetSeparator />
        <SheetStatRow label={tr(app, STR.target)} value={target.toLocaleString()} />
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
