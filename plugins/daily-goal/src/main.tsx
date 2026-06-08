import * as React from 'react';
import {
  Plugin,
  resolveLocalizedText,
  type CountOptions,
  type FieldConditions,
  type HostApi,
  type LocalizedText,
  type SettingsSchema,
  type SessionTotals,
  type WidgetProps
} from '@pensiv/plugin-sdk';
import './styles.css';
import { confettiBurst, confettiConfigForCorner, readWidgetCorner } from './confetti';
import { DailyGoalSheet } from './sheet';

const WIDGET_STORAGE_KEY = 'pensiv:daily-goal:corner';

/** Localized-text helper: `L(en, ko, ja)`. */
const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });
const tr = (app: HostApi, t: LocalizedText) => resolveLocalizedText(t, app.app.locale);

const STR = {
  title: L('Daily Goal', '일일 목표', '毎日の目標'),
  total: L('Total', '합계', '合計'),
  words: L('Words', '단어', '言葉'),
  chars: L('Chars', '글자', '文字'),
  addedToday: L('added today', '오늘 입력', '今日追加されました'),
  removedToday: L('removed today', '오늘 지움', '今日削除されました')
};

/**
 * Daily Goal — a Words/Chars goal type, a target, and three widget-row
 * visibility toggles (total / added today / removed today). Account-wide; reads
 * today's progress from the session API. For character goals it also offers the
 * same granular counting rules as Document Goal (a "use editor counting" toggle
 * that, when off, exposes per-glyph rules); the rules apply to *future* edits —
 * progress recorded before the rules changed (or on older devices) can't be
 * filtered retroactively and counts in full. Enable/disable is governed by the
 * plugin's own on/off state (Plugins manage page), so there is no in-settings
 * enable toggle.
 */
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
            { value: 'words', label: STR.words },
            { value: 'characters', label: STR.chars }
          ]
        },
        {
          key: 'target',
          type: 'number',
          label: L('Target', '목표', 'ターゲット'),
          description: L('Set your daily writing target', '일일 작성 목표를 설정하세요', '毎日の執筆目標を設定する'),
          default: 1000,
          min: 10,
          max: 1000000
        },
        {
          key: 'showTotal',
          type: 'toggle',
          label: L('Show total', '합계 표시', '合計を表示'),
          description: L(
            "Show your total progress toward the goal.",
            '목표 대비 전체 진행량을 표시합니다.',
            '目標に対する合計の進捗を表示します。'
          ),
          default: true
        },
        {
          key: 'showAdded',
          type: 'toggle',
          label: L('Show added today', '오늘 입력 표시', '今日追加分を表示'),
          description: L(
            "Show how much you've added today.",
            '오늘 추가한 양을 표시합니다.',
            '今日追加した分を表示します。'
          ),
          default: true
        },
        {
          key: 'showRemoved',
          type: 'toggle',
          label: L('Show removed today', '오늘 지움 표시', '今日削除分を表示'),
          description: L(
            "Show how much you've removed today.",
            '오늘 삭제한 양을 표시합니다.',
            '今日削除した分を表示します。'
          ),
          default: true
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
    },
    {
      type: 'group',
      fields: [
        {
          key: 'showFloatingWidget',
          type: 'toggle',
          label: L('Show Floating Widget', '플로팅 위젯 표시', 'フローティングウィジェットを表示'),
          description: L(
            'Display a draggable progress widget on screen',
            '드래그 가능한 진행률 위젯을 화면에 표시합니다',
            'ドラッグ可能な進捗ウィジェットを画面上に表示する'
          ),
          // Shown by default (preserves prior always-on behavior); toggle off to hide.
          default: true,
          // Floating widget is a desktop/tablet surface — phones use the tray chip.
          formFactors: ['desktop', 'tablet', 'web']
        }
      ]
    }
  ]
};

const ZERO: SessionTotals = {
  added: { words: 0, chars: 0 },
  removed: { words: 0, chars: 0 },
  net: { words: 0, chars: 0 }
};

const bool = (app: WidgetProps['app'], key: string) => app.storage.get<boolean>(key) ?? true;

/**
 * The character counting rules for a character goal, mirroring Document Goal:
 * inherit the editor word counter, or a custom per-glyph rule set. Returns
 * `undefined` for word goals (and the "inherit" path resolves to the user's
 * configured word counter, read from settings — safe even with no editor focused).
 */
function ruleOptions(app: WidgetProps['app']): CountOptions | undefined {
  const type = app.storage.get<string>('type') ?? 'words';
  if (type !== 'characters') return undefined;
  if (app.storage.get<boolean>('useEditorCounting') ?? true) {
    return { ...app.editor.wordCounter(), countType: 'character' };
  }
  return {
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
  };
}

/**
 * Today's session totals for the configured goal, guarded against an unavailable
 * session — render-safe. For character goals it applies the granular rules via
 * `session.countToday`; for word goals (or hosts without `countToday`) it falls
 * back to `session.today()` (all categories), so the widget still works on an
 * older app build.
 */
export function sessionTodaySafe(app: WidgetProps['app']): SessionTotals {
  try {
    const opts = ruleOptions(app);
    if (opts && typeof app.session.countToday === 'function') {
      return app.session.countToday(opts);
    }
    return app.session.today();
  } catch {
    return ZERO;
  }
}

/** Net progress for the configured goal type. */
export function dailyNet(app: WidgetProps['app']): number {
  const type = app.storage.get<string>('type') ?? 'words';
  const totals = sessionTodaySafe(app);
  return type === 'words' ? totals.net.words : totals.net.chars;
}

/** A `label — value` line, baseline-aligned (native parity). */
const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.25rem' }}>
    <span style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>{label}</span>
    <span
      className="pnsv-tabnum"
      style={{ fontSize: '0.875rem', fontWeight: 500, letterSpacing: '-0.04em' }}
    >
      {value}
    </span>
  </div>
);

const CogIcon: React.FC = () => (
  <svg style={{ width: '1rem', height: '1rem' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

function DailyGoalWidget({ app }: WidgetProps) {
  const type = (app.storage.get<string>('type') ?? 'words') as 'words' | 'characters';
  const target = app.storage.get<number>('target') ?? 1000;
  const showTotal = app.storage.get<boolean>('showTotal') ?? true;
  const showAdded = app.storage.get<boolean>('showAdded') ?? true;
  const showRemoved = app.storage.get<boolean>('showRemoved') ?? true;
  const unit = type === 'words' ? tr(app, STR.words) : tr(app, STR.chars);

  // Derived in render from live settings + session; `change` drives session ticks.
  // Settings changes (type / target / row toggles) re-render via the host, so the
  // widget reflects any option change immediately with no stale cache.
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => app.session.on('change', bump), [app]);
  const totals = sessionTodaySafe(app);

  const pick = (p: { words: number; chars: number }) => (type === 'words' ? p.words : p.chars);
  const current = pick(totals.net);
  const pct = Math.min(100, target > 0 ? (current / target) * 100 : 0);
  const achieved = target > 0 && current >= target;

  // Confetti once per day, persisted — so a reload (totals briefly load as 0,
  // then jump to achieved) doesn't re-fire it for a goal already celebrated today.
  const today = new Date().toISOString().slice(0, 10);
  const prevAchieved = React.useRef<boolean | null>(null);
  React.useEffect(() => {
    if (prevAchieved.current === null) {
      prevAchieved.current = achieved;
      return;
    }
    if (achieved && !prevAchieved.current && app.storage.get<string>('celebratedOn') !== today) {
      const cfg = confettiConfigForCorner(readWidgetCorner(WIDGET_STORAGE_KEY));
      confettiBurst({ particleCount: 50, spread: 55, angle: cfg.angle, origin: cfg.origin });
      app.storage.set('celebratedOn', today);
    }
    prevAchieved.current = achieved;
  }, [achieved]);

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
          <div style={{ margin: '0 0.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {showTotal && (
              <Row
                label={`${tr(app, STR.total)} ${unit}`}
                value={`${current.toLocaleString()} / ${target.toLocaleString()} ${unit}`}
              />
            )}
            {showAdded && (
              <Row label={tr(app, STR.addedToday)} value={`${pick(totals.added).toLocaleString()} ${unit}`} />
            )}
            {showRemoved && (
              <Row label={tr(app, STR.removedToday)} value={`${pick(totals.removed).toLocaleString()} ${unit}`} />
            )}
          </div>
          <div className="pnsv-track">
            <div className="pnsv-bar" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact tray chip (mobile): two stacked lines — net value + unit — matching
 *  the native `PaneDailyGoalChip`. White + difference blend (host owns the pill). */
function DailyGoalChip({ app }: WidgetProps) {
  const type = (app.storage.get<string>('type') ?? 'words') as 'words' | 'characters';
  // Derived in render from live settings + session, so switching the goal type
  // updates the pill immediately; `change` drives session ticks.
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => app.session.on('change', bump), [app]);
  const totals = sessionTodaySafe(app);
  const current = type === 'words' ? totals.net.words : totals.net.chars;
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
        {current.toLocaleString()}
      </span>
      <span style={{ ...line, fontSize: '0.75rem', lineHeight: 1.1, opacity: 0.6 }}>{unitShort}</span>
    </span>
  );
}

export default class DailyGoalPlugin extends Plugin {
  onload(): void {
    this.addSettingTab({ title: tr(this.app, STR.title), schema: settings });
    this.registerWidget({
      id: 'daily-goal',
      surface: 'floating',
      frame: 'floating',
      defaultCorner: 'bottom-right',
      storageKey: WIDGET_STORAGE_KEY,
      // Desktop/tablet floating widget, shown by default and hideable via the
      // settings toggle; phones use the tray chip below, gated separately by `showChip`.
      shouldRender: ({ app }) => app.storage.get<boolean>('showFloatingWidget') ?? true,
      // Tray chip shown by default; hideable from the pane "Widgets" manage sheet.
      chipShouldRender: ({ app }) => app.storage.get<boolean>('showChip') !== false,
      // Accent ring when today's goal is met (native parity).
      chipAccent: ({ app }) => {
        const target = app.storage.get<number>('target') ?? 1000;
        return target > 0 && dailyNet(app) >= target;
      },
      component: DailyGoalWidget,
      chip: DailyGoalChip,
      // Phone bottom-sheet: native-style `SheetItemGroup` stat rows + settings
      // action (mirrors the old `ProjectPaneDailyGoalBottomSheet`), not the
      // floating card — so it matches the rest of the mobile sheet UI and grows
      // to fit its content.
      sheet: DailyGoalSheet
    });
  }
}
