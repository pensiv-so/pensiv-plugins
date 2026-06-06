import type { SettingsSchema } from '@pensiv/plugin-sdk';
import { L } from './i18n';

/**
 * Mirrors the native Timer settings tab one-for-one: three quick presets, a
 * timer/stopwatch mode, the floating-widget toggle, and the menu-bar icon style.
 * Each section maps to a bordered, muted group like the native form.
 */
export const settingsSchema: SettingsSchema = {
  fields: [
    {
      type: 'group',
      fields: [
        {
          key: 'presets',
          type: 'list',
          itemType: 'number',
          label: L('Timer Presets (min)', '타이머 프리셋(분)', 'タイマーのプリセット (分)'),
          description: L('Quick-select timer durations', '빠르게 선택할 타이머 시간', 'タイマー期間のクイック選択'),
          default: [5, 30, 50],
          minItems: 3,
          maxItems: 3,
          itemMin: 1,
          itemMax: 120
        }
      ]
    },
    {
      type: 'group',
      fields: [
        {
          key: 'mode',
          type: 'radio',
          label: L('Timer Mode', '타이머 모드', 'タイマーモード'),
          description: L(
            'Choose between countdown timer or stopwatch',
            '카운트다운 타이머 또는 스톱워치 중 선택하세요',
            'カウントダウンタイマーまたはストップウォッチのいずれかを選択してください'
          ),
          default: 'timer',
          options: [
            { value: 'timer', label: L('Timer', '타이머', 'タイマー') },
            { value: 'stopwatch', label: L('Stopwatch', '스톱워치', 'ストップウォッチ') }
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
            'Display a draggable timer widget on screen',
            '드래그 가능한 타이머 위젯을 화면에 표시합니다',
            'ドラッグ可能なタイマー ウィジェットを画面上に表示する'
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
            'Choose how the timer button appears',
            '타이머 버튼 표시 방식을 선택하세요',
            'タイマーボタンの表示方法を選択します'
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
