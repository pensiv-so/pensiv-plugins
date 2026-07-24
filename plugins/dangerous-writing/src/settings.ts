import type { HostApi, SettingsSchema } from '@pensiv/plugin-sdk';
import { L } from './i18n';
import type { GoalType, SessionConfig } from './store';

/**
 * The plugin's settings tab — just the goal and the difficulty. Sessions always
 * run on the open document; there is no prompt, sound, or practice mode. Values
 * live in `app.storage`; {@link readConfig} reads them back into a
 * {@link SessionConfig} when a session starts.
 */
export const settingsSchema: SettingsSchema = {
  fields: [
    {
      type: 'group',
      title: L('Goal', '목표', '目標'),
      fields: [
        {
          key: 'goalType',
          type: 'radio',
          label: L('Goal type', '목표 유형', '目標の種類'),
          description: L(
            'Survive for a length of time, or write a number of words.',
            '일정 시간을 버티거나, 정해진 단어 수를 작성하세요.',
            '一定時間を生き延びるか、一定の単語数を書くか。'
          ),
          default: 'time',
          options: [
            { value: 'time', label: L('Time', '시간', '時間') },
            { value: 'words', label: L('Words', '단어', '単語') }
          ]
        },
        {
          key: 'durationSec',
          type: 'select',
          label: L('Duration', '시간', '時間'),
          description: L(
            'How long to keep writing.',
            '얼마나 오래 쓸지.',
            'どれくらい書き続けるか。'
          ),
          default: '600',
          visibleWhen: { key: 'goalType', equals: 'time' },
          options: [
            { value: '300', label: L('5 minutes', '5분', '5分') },
            { value: '600', label: L('10 minutes', '10분', '10分') },
            { value: '1200', label: L('20 minutes', '20분', '20分') }
          ]
        },
        {
          key: 'wordTarget',
          type: 'number',
          label: L('Word target', '단어 목표', '単語の目標'),
          description: L(
            'Words to write before you are safe.',
            '안전해지기까지 작성할 단어 수.',
            '安全になるまでに書く単語数。'
          ),
          default: 500,
          min: 25,
          max: 100000,
          step: 25,
          visibleWhen: { key: 'goalType', equals: 'words' }
        }
      ]
    },
    {
      type: 'group',
      title: L('Difficulty', '난이도', '難易度'),
      description: L(
        'Sessions run on your OPEN document. Stop typing past the limit and its content is erased for good — there is no undo.',
        '세션은 열린 문서에서 실행됩니다. 한도를 넘겨 멈추면 내용이 영구히 지워집니다 — 실행 취소는 없습니다.',
        'セッションは開いているドキュメントで実行されます。限界を超えて止まると内容は永久に消去され、取り消しはできません。'
      ),
      fields: [
        {
          key: 'fuseSec',
          type: 'slider',
          label: L('Idle limit before wipe', '삭제까지 멈춤 한도', '消去までの停止限界'),
          description: L(
            'Stop typing for longer than this and your document is erased.',
            '이 시간보다 오래 멈추면 문서가 지워집니다.',
            'これより長く止まるとドキュメントが消えます。'
          ),
          default: 5,
          min: 3,
          max: 10,
          step: 1,
          unit: 's'
        },
        {
          key: 'hardcore',
          type: 'toggle',
          label: L('Hardcore', '하드코어', 'ハードコア'),
          description: L(
            'A shorter fuse and almost no warning before the wipe.',
            '더 짧은 도화선과 삭제 전 거의 없는 경고.',
            'より短い導火線と、消去前のほぼ無警告。'
          ),
          default: false
        }
      ]
    }
  ]
};

/**
 * Build the {@link SessionConfig} for a new session from current settings.
 * Hardcore shortens the fuse here so the store stays difficulty-agnostic.
 */
export function readConfig(app: HostApi): SessionConfig {
  const goalType = (app.storage.get<string>('goalType') ?? 'time') as GoalType;
  const durationSec = parseInt(app.storage.get<string>('durationSec') ?? '600', 10) || 600;
  const wordTarget = app.storage.get<number>('wordTarget') ?? 500;
  const baseFuse = app.storage.get<number>('fuseSec') ?? 5;
  const hardcore = app.storage.get<boolean>('hardcore') ?? false;
  const fuseSec = hardcore ? Math.max(2, baseFuse - 2) : baseFuse;
  return { goalType, durationSec, wordTarget, fuseSec, hardcore };
}
