import type { HostApi, SettingsSchema } from '@pensiv/plugin-sdk';
import { L } from './i18n';

/**
 * Declarative settings — how precise the result is, whether the historical East
 * Asian units are offered, what the insert button writes, and which surfaces are
 * on. Values persist under their `key` in the plugin's `app.storage`; components
 * read them back through {@link readSettings}.
 */
export const settingsSchema: SettingsSchema = {
  fields: [
    {
      type: 'group',
      title: L('Conversion', '변환', '変換'),
      fields: [
        {
          key: 'precision',
          type: 'number',
          label: L('Decimal places', '소수점 자리', '小数点以下の桁数'),
          description: L(
            'Trailing zeros are dropped, and very small or very large results fall back to exponential.',
            '끝자리 0은 표시하지 않으며, 아주 작거나 큰 값은 지수 표기로 바뀝니다.',
            '末尾の 0 は表示せず、極端に小さい／大きい値は指数表記になります。'
          ),
          default: 4,
          min: 0,
          max: 10
        },
        {
          key: 'includeHistorical',
          type: 'toggle',
          label: L('Include old East Asian units', '옛 단위(척관법) 포함', '尺貫法の単位を含める'),
          description: L(
            'Adds 尺 / 里 / 坪 / 斤 / 되 and their neighbours — the units period fiction is actually written in.',
            '자·리·평·근·되 같은 척관법 단위를 함께 보여 줍니다. 시대물을 쓸 때 실제로 쓰이는 단위입니다.',
            '尺・里・坪・斤・升などを併せて表示します。時代物で実際に使われる単位です。'
          ),
          default: true
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
          default: 'result',
          options: [
            {
              value: 'result',
              label: L('Result only (12.5 km)', '결과만 (12.5 km)', '結果のみ (12.5 km)')
            },
            {
              value: 'both',
              label: L(
                'Both sides (5 mi = 8.05 km)',
                '양쪽 모두 (5 mi = 8.05 km)',
                '両方 (5 mi = 8.05 km)'
              )
            },
            {
              value: 'number',
              label: L('The number alone (8.05)', '숫자만 (8.05)', '数値のみ (8.05)')
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
            'Keep a draggable converter on screen while you write',
            '집필 중에도 드래그할 수 있는 변환기를 화면에 띄워 둡니다',
            '執筆中もドラッグ可能な変換ツールを画面に表示しておきます'
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
            'Offer the converter as a pill in the phone widget tray',
            '휴대폰 위젯 트레이에 변환기를 칩으로 표시합니다',
            'スマートフォンのウィジェットトレイに変換ツールをチップとして表示します'
          ),
          default: true
        }
      ]
    }
  ]
};

export interface ConverterSettings {
  precision: number;
  includeHistorical: boolean;
  insertFormat: 'result' | 'both' | 'number';
}

/** Durable settings, read back with their defaults. */
export const readSettings = (app: HostApi): ConverterSettings => ({
  precision: app.storage.get<number>('precision') ?? 4,
  // On by default: pensiv's writers are disproportionately writing in or about
  // Korea and Japan, where 평 and 근 are still how people speak.
  includeHistorical: app.storage.get<boolean>('includeHistorical') ?? true,
  insertFormat: app.storage.get<'result' | 'both' | 'number'>('insertFormat') ?? 'result'
});
