import type { HostApi, SettingsSchema } from '@pensiv/plugin-sdk';
import { L } from './i18n';

/**
 * Declarative settings — how the number reads, what "insert" writes, and which
 * surfaces are offered. Values persist under their `key` in the plugin's
 * `app.storage`; components read them back through {@link readSettings}.
 */
export const settingsSchema: SettingsSchema = {
  fields: [
    {
      type: 'group',
      title: L('Display', '표시', '表示'),
      fields: [
        {
          key: 'groupThousands',
          type: 'toggle',
          label: L('Group thousands', '천 단위 구분', '桁区切りを表示'),
          description: L(
            'Show a separator every three digits (1,234,567)',
            '세 자리마다 구분 기호를 표시합니다 (1,234,567)',
            '3 桁ごとに区切り記号を表示します (1,234,567)'
          ),
          default: true
        },
        {
          key: 'decimals',
          type: 'number',
          label: L('Decimal places', '소수점 자리', '小数点以下の桁数'),
          description: L(
            'Only the displayed number is rounded — the running calculation keeps full precision.',
            '표시되는 숫자만 반올림하며, 실제 계산은 전체 정밀도를 유지합니다.',
            '表示される数値のみを丸めます。計算自体は完全な精度を保ちます。'
          ),
          default: 6,
          min: 0,
          max: 12
        },
        {
          key: 'showTape',
          type: 'toggle',
          label: L('Show history', '기록 표시', '履歴を表示'),
          description: L(
            'Keep the last few finished calculations above the keypad; tap one to reuse it',
            '최근 계산 결과를 키패드 위에 남겨 두고, 눌러서 다시 사용합니다',
            '直近の計算結果をキーパッドの上に残し、タップして再利用できます'
          ),
          default: true
        }
      ]
    },
    {
      type: 'group',
      title: L('Insert', '삽입', '挿入'),
      description: L(
        'What the insert button writes at the cursor of the open document or sheet.',
        '삽입 버튼이 열려 있는 문서나 시트의 커서 위치에 써 넣을 내용입니다.',
        '挿入ボタンが、開いている文書やシートのカーソル位置に書き込む内容です。'
      ),
      fields: [
        {
          key: 'insertFormat',
          type: 'select',
          label: L('Insert as', '삽입 형식', '挿入形式'),
          default: 'result',
          options: [
            {
              value: 'result',
              label: L('Result only (1,234)', '결과만 (1,234)', '結果のみ (1,234)')
            },
            {
              value: 'expression',
              label: L(
                'Expression and result (12 × 4 = 48)',
                '식과 결과 (12 × 4 = 48)',
                '式と結果 (12 × 4 = 48)'
              )
            }
          ]
        },
        {
          key: 'insertGrouped',
          type: 'toggle',
          label: L('Insert with separators', '구분 기호 포함', '区切り記号を含める'),
          description: L(
            'Off inserts a plain 1234567 — the form you want inside a formula or a table cell',
            '끄면 1234567처럼 구분 기호 없이 삽입합니다. 수식이나 표 셀에 넣을 때 유용합니다',
            'オフにすると 1234567 のように区切りなしで挿入します。数式や表のセルに適した形式です'
          ),
          default: true
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
            'Keep a draggable calculator on screen while you write',
            '집필 중에도 드래그할 수 있는 계산기를 화면에 띄워 둡니다',
            '執筆中もドラッグ可能な電卓を画面に表示しておきます'
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
            'Offer the calculator as a pill in the phone widget tray',
            '휴대폰 위젯 트레이에 계산기를 칩으로 표시합니다',
            'スマートフォンのウィジェットトレイに電卓をチップとして表示します'
          ),
          default: true
        }
      ]
    }
  ]
};

export interface CalculatorSettings {
  groupThousands: boolean;
  decimals: number;
  showTape: boolean;
  insertFormat: 'result' | 'expression';
  insertGrouped: boolean;
}

/** Durable settings, read back with their defaults. */
export const readSettings = (app: HostApi): CalculatorSettings => ({
  groupThousands: app.storage.get<boolean>('groupThousands') ?? true,
  decimals: app.storage.get<number>('decimals') ?? 6,
  showTape: app.storage.get<boolean>('showTape') ?? true,
  insertFormat: app.storage.get<'result' | 'expression'>('insertFormat') ?? 'result',
  insertGrouped: app.storage.get<boolean>('insertGrouped') ?? true
});
