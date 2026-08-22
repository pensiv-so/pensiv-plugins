import type { HostApi, SettingsSchema } from '@pensiv/plugin-sdk';
import type { DateFormat } from './engine';
import type { Mode } from './store';
import { L } from './i18n';

/**
 * Declarative settings — how dates read, which ages are shown, what the insert
 * button writes, and which surfaces are offered. Values persist under their `key`
 * in the plugin's `app.storage`; components read them back through
 * {@link readSettings}.
 */
export const settingsSchema: SettingsSchema = {
  fields: [
    {
      type: 'group',
      title: L('Dates', '날짜', '日付'),
      fields: [
        {
          key: 'dateFormat',
          type: 'select',
          label: L('Date format', '날짜 표기', '日付の表記'),
          description: L(
            'How results are shown and inserted. The date fields themselves always use your system format.',
            '결과를 표시하고 삽입할 때의 형식입니다. 입력란 자체는 시스템 형식을 따릅니다.',
            '結果の表示と挿入に使う形式です。入力欄自体はシステムの形式に従います。'
          ),
          default: 'iso',
          options: [
            { value: 'iso', label: L('2026-08-22', '2026-08-22', '2026-08-22') },
            { value: 'dotted', label: L('2026. 8. 22.', '2026. 8. 22.', '2026. 8. 22.') },
            {
              value: 'locale',
              label: L('August 22, 2026', '2026년 8월 22일', '2026年8月22日')
            }
          ]
        },
        {
          key: 'defaultMode',
          type: 'select',
          label: L('Open on', '기본 모드', '起動時のモード'),
          default: 'age',
          options: [
            { value: 'age', label: L('Age', '나이', '年齢') },
            { value: 'between', label: L('Between two dates', '두 날짜 사이', '2 つの日付の間') },
            { value: 'shift', label: L('Add / subtract', '날짜 더하기', '日付を加減') }
          ]
        }
      ]
    },
    {
      type: 'group',
      title: L('Age', '나이', '年齢'),
      fields: [
        {
          key: 'showKoreanAge',
          type: 'toggle',
          label: L('Show Korean counting age', '한국식 나이 표시', '韓国式の数え年を表示'),
          description: L(
            'Age counted from 1 at birth, rising every New Year — how a Korean character would say their own age.',
            '태어나면 1살, 해가 바뀔 때마다 한 살씩 더하는 세는 나이입니다.',
            '生まれた時を 1 歳とし、年が明けるごとに 1 歳増える数え方です。'
          ),
          default: true
        },
        {
          key: 'showYearAge',
          type: 'toggle',
          label: L('Show year age', '연 나이 표시', '年齢（年差）を表示'),
          description: L(
            'The plain year difference, ignoring the birthday — used for school years and conscription.',
            '생일과 무관하게 연도만 빼서 계산하는 나이입니다. 학년·병역 기준에 쓰입니다.',
            '誕生日を問わず年の差だけで数える年齢です。学年や徴兵の基準に使われます。'
          ),
          default: false
        }
      ]
    },
    {
      type: 'group',
      title: L('Between two dates', '두 날짜 사이', '2 つの日付の間'),
      fields: [
        {
          key: 'includeEndDate',
          type: 'toggle',
          label: L('Count the end date', '종료일 포함', '終了日を含める'),
          description: L(
            'On, 1 – 3 August is 3 days (inclusive). Off, it is 2 — the number of nights between them.',
            '켜면 8월 1일부터 3일까지가 3일(양쪽 포함)이 되고, 끄면 2일이 됩니다.',
            'オンなら 8/1 〜 8/3 は 3 日（両端を含む）、オフなら 2 日になります。'
          ),
          default: false
        }
      ]
    },
    {
      type: 'group',
      title: L('Insert', '삽입', '挿入'),
      fields: [
        {
          key: 'insertFormat',
          type: 'select',
          label: L('Insert as', '삽입 형식', '挿入形式'),
          description: L(
            'What the insert button writes at the cursor of the open document or sheet.',
            '삽입 버튼이 열려 있는 문서나 시트의 커서 위치에 써 넣을 내용입니다.',
            '挿入ボタンが、開いている文書やシートのカーソル位置に書き込む内容です。'
          ),
          default: 'value',
          options: [
            { value: 'value', label: L('The result only', '결과만', '結果のみ') },
            {
              value: 'summary',
              label: L('Result with its dates', '날짜와 함께', '日付を添えて')
            }
          ]
        }
      ]
    },
    {
      type: 'group',
      title: L('Surfaces', '표시 위치', '表示場所'),
      fields: [
        {
          key: 'showFloatingWidget',
          type: 'toggle',
          label: L('Show floating widget', '플로팅 위젯 표시', 'フローティングウィジェットを表示'),
          description: L(
            'Keep a draggable date calculator on screen while you write',
            '집필 중에도 드래그할 수 있는 날짜 계산기를 화면에 띄워 둡니다',
            '執筆中もドラッグ可能な日付計算機を画面に表示しておきます'
          ),
          default: false,
          // The floating card is a desktop/tablet surface — phones use the chip.
          formFactors: ['desktop', 'tablet', 'web']
        },
        {
          key: 'showChip',
          type: 'toggle',
          label: L('Show tray chip', '트레이 칩 표시', 'トレイチップを表示'),
          description: L(
            'Offer the date calculator as a pill in the phone widget tray',
            '휴대폰 위젯 트레이에 날짜 계산기를 칩으로 표시합니다',
            'スマートフォンのウィジェットトレイに日付計算機をチップとして表示します'
          ),
          default: true
        }
      ]
    }
  ]
};

export interface DateSettings {
  dateFormat: DateFormat;
  defaultMode: Mode;
  showKoreanAge: boolean;
  showYearAge: boolean;
  includeEndDate: boolean;
  insertFormat: 'value' | 'summary';
}

/** Durable settings, read back with their defaults. */
export const readSettings = (app: HostApi): DateSettings => ({
  dateFormat: app.storage.get<DateFormat>('dateFormat') ?? 'iso',
  defaultMode: app.storage.get<Mode>('defaultMode') ?? 'age',
  // The counting age is the one a Korean or Japanese reader expects to see, so
  // it defaults on; it costs one line and answers "how old is she, really".
  showKoreanAge: app.storage.get<boolean>('showKoreanAge') ?? true,
  showYearAge: app.storage.get<boolean>('showYearAge') ?? false,
  includeEndDate: app.storage.get<boolean>('includeEndDate') ?? false,
  insertFormat: app.storage.get<'value' | 'summary'>('insertFormat') ?? 'value'
});
