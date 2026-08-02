import type { SettingsSchema } from '@pensiv/plugin-sdk';
import { L } from './i18n';

/**
 * Declarative settings — durations, cycle length, what starts itself, how the
 * phase end announces itself, and the two surface toggles. Grouped like the
 * native Timer form (one bordered section per concern). Values persist under
 * their `key` in the plugin's `app.storage`; components read them back as
 * `app.storage.get(key) ?? default` and push them into the run-state store.
 */
/**
 * Defaults for the three user-chosen phase colours — one per phase, since the
 * badge, the lit ticks and the header ring all read as "which phase is this".
 * Hex rather than `hsl(var(--chart-1))` because the host's colour field stores a
 * plain CSS colour; these are the app's `--chart-1` / `--chart-3` / `--chart-2`
 * resolved, so an untouched install still looks like pensiv.
 */
export const DEFAULT_FOCUS_COLOR = '#2f7ce0';
export const DEFAULT_SHORT_BREAK_COLOR = '#78b336';
export const DEFAULT_LONG_BREAK_COLOR = '#12968a';

export const settingsSchema: SettingsSchema = {
  fields: [
    {
      type: 'group',
      title: L('Colour', '색', '色'),
      description: L(
        'Each phase gets its own colour — the badge, the dial ticks and the header ring follow it.',
        '페이즈마다 색을 따로 정합니다. 뱃지와 다이얼 눈금, 헤더 링이 이 색을 따릅니다.',
        'フェーズごとに色を設定します。バッジ・ダイヤルの目盛り・ヘッダーのリングがこの色に従います。'
      ),
      fields: [
        {
          key: 'focusColor',
          type: 'color',
          label: L('Focus', '집중', '集中'),
          default: DEFAULT_FOCUS_COLOR
        },
        {
          key: 'shortBreakColor',
          type: 'color',
          label: L('Short break', '짧은 휴식', '小休憩'),
          default: DEFAULT_SHORT_BREAK_COLOR
        },
        {
          key: 'longBreakColor',
          type: 'color',
          label: L('Long break', '긴 휴식', '長い休憩'),
          default: DEFAULT_LONG_BREAK_COLOR
        }
      ]
    },
    {
      type: 'group',
      title: L('Durations', '시간', '時間'),
      fields: [
        {
          key: 'focusMinutes',
          type: 'number',
          label: L('Focus (min)', '집중(분)', '集中 (分)'),
          description: L(
            'Length of one focus block',
            '한 번의 집중 블록 길이',
            '1 回の集中ブロックの長さ'
          ),
          default: 25,
          min: 1,
          max: 180
        },
        {
          key: 'shortBreakMinutes',
          type: 'number',
          label: L('Short break (min)', '짧은 휴식(분)', '小休憩 (分)'),
          description: L(
            'Break after each focus block',
            '집중 블록마다 이어지는 휴식',
            '各集中ブロックの後の休憩'
          ),
          default: 5,
          min: 1,
          max: 60
        },
        {
          key: 'longBreakMinutes',
          type: 'number',
          label: L('Long break (min)', '긴 휴식(분)', '長い休憩 (分)'),
          description: L(
            'Break at the end of a cycle',
            '한 사이클이 끝난 뒤의 휴식',
            'サイクル終了後の休憩'
          ),
          default: 15,
          min: 1,
          max: 90
        },
        {
          key: 'cycleLength',
          type: 'number',
          label: L('Focus blocks per cycle', '사이클당 집중 횟수', 'サイクルあたりの集中回数'),
          description: L(
            'How many focus blocks before a long break',
            '긴 휴식까지 필요한 집중 블록 수',
            '長い休憩までの集中ブロック数'
          ),
          default: 4,
          min: 2,
          max: 12
        }
      ]
    },
    {
      type: 'group',
      title: L('Flow', '흐름', '流れ'),
      fields: [
        {
          key: 'autoStartBreaks',
          type: 'toggle',
          label: L('Auto-start breaks', '휴식 자동 시작', '休憩を自動開始'),
          description: L(
            'Begin the break as soon as a focus block ends',
            '집중 블록이 끝나면 곧바로 휴식을 시작합니다',
            '集中ブロックが終わるとすぐ休憩を開始します'
          ),
          default: true
        },
        {
          key: 'autoStartFocus',
          type: 'toggle',
          label: L('Auto-start focus', '집중 자동 시작', '集中を自動開始'),
          description: L(
            'Begin the next focus block as soon as a break ends',
            '휴식이 끝나면 곧바로 다음 집중 블록을 시작합니다',
            '休憩が終わるとすぐ次の集中ブロックを開始します'
          ),
          default: false
        }
      ]
    },
    {
      type: 'group',
      title: L('When a phase ends', '단계가 끝날 때', 'フェーズ終了時'),
      fields: [
        {
          key: 'playSound',
          type: 'toggle',
          label: L('Play a chime', '알림음 재생', 'チャイムを鳴らす'),
          description: L(
            "Play the app's chime when focus or a break ends",
            '집중이나 휴식이 끝나면 앱 알림음을 재생합니다',
            '集中や休憩が終わったらアプリのチャイムを鳴らします'
          ),
          default: true
        },
        {
          key: 'notify',
          type: 'toggle',
          label: L('Send a notification', '알림 보내기', '通知を送る'),
          description: L(
            'Post a system notification so you notice it away from the window',
            '창을 벗어나 있어도 알 수 있도록 시스템 알림을 보냅니다',
            'ウィンドウから離れていても気づけるようシステム通知を送ります'
          ),
          default: true
        }
      ]
    },
    {
      type: 'group',
      title: L('Appearance', '표시', '表示'),
      fields: [
        {
          key: 'showFloatingWidget',
          type: 'toggle',
          label: L('Show Floating Widget', '플로팅 위젯 표시', 'フローティングウィジェットを表示'),
          description: L(
            'Display a draggable pomodoro widget on screen',
            '드래그 가능한 뽀모도로 위젯을 화면에 표시합니다',
            'ドラッグ可能なポモドーロウィジェットを画面上に表示する'
          ),
          default: false,
          // Floating widget is a desktop/tablet surface — phones use the tray chip.
          formFactors: ['desktop', 'tablet', 'web']
        },
        {
          key: 'menuBarIconMode',
          type: 'radio',
          label: L('Menu Bar Icon', '메뉴바 아이콘', 'メニューバーアイコン'),
          description: L(
            'Choose how the pomodoro button appears',
            '뽀모도로 버튼 표시 방식을 선택하세요',
            'ポモドーロボタンの表示方法を選択します'
          ),
          default: 'expanded',
          options: [
            { value: 'compact', label: L('Compact', '컴팩트', 'コンパクト') },
            { value: 'expanded', label: L('Expanded', '확장', '拡張された') }
          ],
          // Menu-bar button is a desktop/tablet concept — not shown on phones.
          formFactors: ['desktop', 'tablet', 'web']
        }
      ]
    }
  ]
};

/** Durable settings, read back with their defaults. Used to drive the run-state store. */
export const readSettings = (get: <T>(key: string) => T | undefined) => ({
  focus: get<number>('focusMinutes') ?? 25,
  shortBreak: get<number>('shortBreakMinutes') ?? 5,
  longBreak: get<number>('longBreakMinutes') ?? 15,
  cycleLength: get<number>('cycleLength') ?? 4,
  autoStartBreaks: get<boolean>('autoStartBreaks') ?? true,
  autoStartFocus: get<boolean>('autoStartFocus') ?? false,
  playSound: get<boolean>('playSound') ?? true,
  notify: get<boolean>('notify') ?? true
});
