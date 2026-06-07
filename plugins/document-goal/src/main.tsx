import * as React from 'react';
import { useEffect, useReducer } from 'react';
import {
  Plugin,
  resolveLocalizedText,
  type CountOptions,
  type FieldConditions,
  type HostApi,
  type LocalizedText,
  type SettingsSchema,
  type WidgetProps
} from '@pensiv/plugin-sdk';
import './styles.css';
import { confettiBurst, confettiConfigForCorner, readWidgetCorner } from './confetti';
import { DocumentGoalSheet } from './sheet';

const WIDGET_STORAGE_KEY = 'pensiv:document-goal:corner';

/**
 * Document Goal — a Words/Chars goal type, a target, and — for character
 * goals — a "use editor counting settings" toggle that, when off, exposes the
 * full granular counting rules (spaces, indents, each quote/bracket glyph group,
 * and other punctuation), just like the editor's word counter. Enable/disable is
 * governed by the plugin's own on/off state (Plugins manage page), so there is no
 * in-settings enable toggle.
 */
/** Localized-text helper: `L(en, ko, ja)`. */
const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });
const tr = (app: HostApi, t: LocalizedText) => resolveLocalizedText(t, app.app.locale);

const STR = {
  title: L('Document Goal', '문서 목표', '目標を文書化する'),
  words: L('Words', '단어', '言葉'),
  chars: L('Chars', '글자', '文字')
};

const CogIcon: React.FC = () => (
  <svg style={{ width: '1rem', height: '1rem' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const charCustom: FieldConditions = [
  { key: 'type', equals: 'characters' },
  { key: 'useEditorCounting', equals: false }
];

const settings: SettingsSchema = {
  fields: [
    {
      type: 'group',
      fields: [
        {
          key: 'type',
          type: 'radio',
          label: L('Goal Type', '목표 유형', '目標の種類'),
          description: L(
            'Choose whether to track words or characters',
            '단어 또는 글자 수를 추적할지 선택하세요',
            '単語または文字を追跡するかどうかを選択します'
          ),
          default: 'words',
          options: [
            { value: 'words', label: L('Words', '단어', '言葉') },
            { value: 'characters', label: L('Chars', '글자', '文字') }
          ]
        },
        {
          key: 'target',
          type: 'number',
          label: L('Target', '목표', 'ターゲット'),
          description: L(
            'Set your daily writing target',
            '일일 작성 목표를 설정하세요',
            '毎日の執筆目標を設定する'
          ),
          default: 5000,
          min: 10,
          max: 1000000
        },
        {
          key: 'useEditorCounting',
          type: 'toggle',
          label: L('Use editor counting settings', '에디터 글자 수 계산 설정 사용', 'エディターのカウント設定を使用'),
          description: L(
            'Count characters the same way as the editor word counter. Turn off to set a dedicated rule for this goal.',
            '에디터 단어 수 계산기와 동일한 방식으로 글자를 셉니다. 끄면 이 목표에만 적용되는 규칙을 설정할 수 있습니다.',
            'エディターの文字カウンターと同じ方法で文字を数えます。オフにすると、この目標専用のルールを設定できます。'
          ),
          default: true,
          visibleWhen: { key: 'type', equals: 'characters' }
        },
        // Custom counting rules — a nested sub-section under the toggle.
        {
          type: 'group',
          visibleWhen: charCustom,
          fields: [
            { key: 'wcIncludeSpace', type: 'toggle', label: L('Include spaces', '공백 포함', 'スペースを含める'), sample: 'a b', default: true },
            { key: 'wcIncludeIndent', type: 'toggle', label: L('Include indentation', '들여쓰기 포함', 'インデントを含める'), sample: '··line', default: true },
            { type: 'divider', label: L('Quotes', '따옴표', '引用') },
            { key: 'wcQuoteStraightDouble', type: 'toggle', label: L('Straight double quote', '직선 쌍따옴표', 'まっすぐな二重引用符'), sample: '"', default: true },
            { key: 'wcQuoteStraightSingle', type: 'toggle', label: L('Straight single quote', '직선 홑따옴표', '直接の一重引用符'), sample: "'", default: true },
            { key: 'wcQuoteCurlyDouble', type: 'toggle', label: L('Curly double quotes', '곡선 쌍따옴표', '二重引用符'), sample: '“ ”', default: true },
            { key: 'wcQuoteCurlySingle', type: 'toggle', label: L('Curly single quotes', '곡선 홑따옴표', '波状の一重引用符'), sample: '‘ ’', default: true },
            { key: 'wcQuoteGuillemets', type: 'toggle', label: L('Guillemets', '겔레멧·인용 괄호', 'ギルメッツ'), sample: '« » ‹ ›', default: true },
            { type: 'divider', label: L('Brackets', '괄호', 'ブラケット') },
            { key: 'wcParenRound', type: 'toggle', label: L('Round brackets', '소괄호', '丸括弧'), sample: '( )', default: true },
            { key: 'wcParenSquare', type: 'toggle', label: L('Square brackets', '대괄호', '角括弧'), sample: '[ ]', default: true },
            { key: 'wcParenCurlyBraces', type: 'toggle', label: L('Curly braces', '중괄호', '中括弧'), sample: '{ }', default: true },
            { key: 'wcParenAngle', type: 'toggle', label: L('Angle brackets', '꺾쇠 괄호', '山括弧'), sample: '< >', default: true },
            { key: 'wcParenCjk', type: 'toggle', label: L('CJK brackets', '한중 괄호', '日中韓ブラケット'), sample: '「」 《》', default: true },
            { type: 'divider' },
            {
              key: 'wcIncludeSpecialChars',
              type: 'toggle',
              label: L('Include other punctuation and symbols', '특문 포함 (구두점·기호 등)', '他の句読点や記号を含める'),
              sample: '.,;:!? …',
              default: true
            }
          ]
        }
      ]
    }
  ]
};

const bool = (app: WidgetProps['app'], key: string) => app.storage.get<boolean>(key) ?? true;

/** Resolve the goal config into a character count via the host counting API. */
export function measure(app: WidgetProps['app'], type: 'words' | 'characters'): number {
  if (type === 'words') return app.editor.count({ countType: 'word' });
  // Inherit (default): use the editor's configured word counter, as characters.
  if (app.storage.get<boolean>('useEditorCounting') ?? true) {
    const inherited: CountOptions = { ...app.editor.wordCounter(), countType: 'character' };
    return app.editor.count(inherited);
  }
  // Custom: the granular per-glyph rule set.
  return app.editor.count({
    countType: 'character',
    includeSpace: bool(app, 'wcIncludeSpace'),
    includeIndent: bool(app, 'wcIncludeIndent'),
    includeSpecialChars: bool(app, 'wcIncludeSpecialChars'),
    includeQuotes: {
      straightDouble: bool(app, 'wcQuoteStraightDouble'),
      straightSingle: bool(app, 'wcQuoteStraightSingle'),
      curlyDouble: bool(app, 'wcQuoteCurlyDouble'),
      curlySingle: bool(app, 'wcQuoteCurlySingle'),
      guillemets: bool(app, 'wcQuoteGuillemets')
    },
    includeParentheses: {
      round: bool(app, 'wcParenRound'),
      square: bool(app, 'wcParenSquare'),
      curlyBraces: bool(app, 'wcParenCurlyBraces'),
      angle: bool(app, 'wcParenAngle'),
      cjk: bool(app, 'wcParenCjk')
    }
  });
}

/** {@link measure} guarded against a not-yet-ready editor — for render-time use. */
export function measureSafe(app: WidgetProps['app'], type: 'words' | 'characters'): number {
  try {
    return measure(app, type);
  } catch {
    return 0;
  }
}

function DocumentGoalWidget({ app }: WidgetProps) {
  const type = (app.storage.get<string>('type') ?? 'words') as 'words' | 'characters';
  const target = app.storage.get<number>('target') ?? 5000;
  const unit = type === 'words' ? tr(app, STR.words) : tr(app, STR.chars);
  const fileId = app.app.fileId;

  // Recompute on editor content changes (the adapter re-binds `update` to the
  // active editor and fires once on switch, so this also covers document
  // switches). Settings changes (type / target / counting rules) re-render the
  // widget via the host, and the count is derived in render — so any option
  // change is reflected immediately, with no stale cache.
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => app.editor.on('update', bump), [app]);
  const count = measureSafe(app, type);

  const pct = Math.min(100, target > 0 ? (count / target) * 100 : 0);
  const achieved = target > 0 && count >= target;

  // Confetti once per document, persisted (native stored it in doc metadata).
  // Reset the transition tracker when the focused document changes.
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
    <div className="pnsv-goal-card" role="status" aria-live="polite">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ marginLeft: '0.25rem', fontSize: '0.875rem', fontWeight: 500, letterSpacing: '-0.01em' }}>
            {tr(app, STR.title)}
          </span>
          <button className="pnsv-cog" title="Settings" aria-label="Settings" onClick={() => app.ui.openSettings()}>
            <CogIcon />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ margin: '0 0.25rem', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
            <span
              className="pnsv-tabnum"
              style={{ fontSize: '1.25rem', fontWeight: 500, letterSpacing: '-0.04em' }}
            >
              {count.toLocaleString()}
            </span>
            <span style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
              / {target.toLocaleString()} {unit}
            </span>
          </div>
          <div className="pnsv-track">
            <div className="pnsv-bar" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact tray chip (mobile): two stacked lines — current count + unit —
 *  matching the native `PaneDocumentGoalChip`. Host owns the pill; the tray gates
 *  visibility to document panes via the widget's `shouldRender`. */
function DocumentGoalChip({ app }: WidgetProps) {
  const type = (app.storage.get<string>('type') ?? 'words') as 'words' | 'characters';
  // Derived in render from live settings + content, so changing the goal type /
  // counting rules recomputes the pill immediately; `update` drives content ticks.
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => app.editor.on('update', bump), [app]);
  const count = measureSafe(app, type);
  const unitShort = type === 'words' ? tr(app, STR.words) : tr(app, STR.chars);
  const line: React.CSSProperties = {
    width: '100%',
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };
  return (
    <span
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        color: '#fff',
        mixBlendMode: 'difference'
      }}
    >
      <span style={{ ...line, fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.05 }}>
        {count.toLocaleString()}
      </span>
      <span style={{ ...line, fontSize: '0.75rem', lineHeight: 1.1, opacity: 0.6 }}>{unitShort}</span>
    </span>
  );
}

export default class DocumentGoalPlugin extends Plugin {
  onload(): void {
    this.addSettingTab({ title: tr(this.app, STR.title), schema: settings });
    this.registerWidget({
      id: 'document-goal',
      surface: 'floating',
      frame: 'floating',
      defaultCorner: 'bottom-right',
      storageKey: WIDGET_STORAGE_KEY,
      // Only while a document editor is focused (native parity) — not on sheets,
      // canvases, plotboards, etc.
      shouldRender: ({ app, projectId }) =>
        !!projectId && app.app.fileType === 'document',
      // Tray chip: same document-only context, plus the user's "Widgets" toggle
      // (shown by default, hideable from the pane manage sheet).
      chipShouldRender: ({ app, projectId }) =>
        app.storage.get<boolean>('showChip') !== false &&
        !!projectId &&
        app.app.fileType === 'document',
      // Accent ring when the document goal is met (native parity).
      chipAccent: ({ app, projectId }) => {
        if (!projectId || app.app.fileType !== 'document') return false;
        const type = (app.storage.get<string>('type') ?? 'words') as 'words' | 'characters';
        const target = app.storage.get<number>('target') ?? 5000;
        return target > 0 && measureSafe(app, type) >= target;
      },
      component: DocumentGoalWidget,
      chip: DocumentGoalChip,
      // Phone bottom-sheet: native-style `SheetItemGroup` Total/Target rows +
      // settings action (mirrors the old `ProjectPaneDocumentGoalBottomSheet`),
      // not the floating card — matches the mobile sheet UI and grows to fit.
      sheet: DocumentGoalSheet
    });
  }
}
