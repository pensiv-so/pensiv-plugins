/**
 * Strings, resolved against `app.app.locale`.
 *
 * Same recipe as the Timer reference plugin: one table of `LocalizedText`, one
 * `t()` bound to the live locale. The host never translates plugin strings.
 */
import { resolveLocalizedText, type HostApi, type LocalizedText } from '@pensiv/plugin-sdk';

const STRINGS = {
  paneTitle: { en: 'Foreshadowing', ko: '복선', ja: '伏線' },
  plant: { en: 'Plant foreshadowing', ko: '복선 심기', ja: '伏線を置く' },
  payOff: { en: 'Pay off foreshadowing', ko: '복선 회수', ja: '伏線を回収' },
  pickHint: {
    en: 'Choose the beat this sentence pays off.',
    ko: '이 문장이 회수하는 복선을 선택하세요.',
    ja: 'この文が回収する伏線を選択してください。'
  },
  planted: { en: 'Foreshadowing planted', ko: '복선을 심었습니다', ja: '伏線を置きました' },
  paidOff: { en: 'Foreshadowing paid off', ko: '복선을 회수했습니다', ja: '伏線を回収しました' },
  deleteBeat: { en: 'Delete', ko: '삭제', ja: '削除' },
  deleted: { en: 'Foreshadowing deleted', ko: '복선을 삭제했습니다', ja: '伏線を削除しました' },
  selectTextFirst: {
    en: 'Select the text to mark first.',
    ko: '표시할 텍스트를 먼저 선택하세요.',
    ja: '先にテキストを選択してください。'
  },
  /**
   * The anchor could not be placed: this view's editor doesn't carry the plugin's
   * mark (e.g. the folder's continuous view). Silence here would read as "it
   * worked" — the mark is a thin underline, so the toast is the only feedback.
   */
  cannotAnchorHere: {
    en: "This view can't hold foreshadowing marks. Open the document on its own tab.",
    ko: '이 화면에서는 복선을 심을 수 없습니다. 문서를 탭으로 열어 주세요.',
    ja: 'この画面では伏線を置けません。ドキュメントをタブで開いてください。'
  },
  open: { en: 'Open', ko: '미회수', ja: '未回収' },
  resolved: { en: 'Paid off', ko: '회수', ja: '回収済み' },
  all: { en: 'All', ko: '전체', ja: 'すべて' },
  preferences: { en: 'Preferences', ko: '설정', ja: '設定' },
  rate: { en: 'Payoff rate', ko: '회수율', ja: '回収率' },
  empty: {
    en: 'No foreshadowing yet. Select a sentence and use the toolbar button.',
    ko: '아직 복선이 없습니다. 문장을 선택하고 툴바 버튼을 누르세요.',
    ja: 'まだ伏線がありません。文を選択してツールバーのボタンを押してください。'
  },
  emptyTitle: { en: 'No foreshadowing yet', ko: '아직 복선이 없습니다', ja: 'まだ伏線がありません' },
  emptyHint: {
    en: 'Select a sentence and press the bookmark in the toolbar.',
    ko: '문장을 선택하고 툴바에서 북마크 버튼을 눌러 보세요.',
    ja: '文を選択してツールバーのブックマークを押してください。'
  },
  emptyOpen: {
    en: 'Every beat is paid off.',
    ko: '모든 복선을 회수했습니다.',
    ja: 'すべての伏線を回収しました。'
  },
  thisFile: { en: 'This file', ko: '이 문서', ja: 'このファイル' },
  project: { en: 'Whole project', ko: '프로젝트 전체', ja: 'プロジェクト全体' },
  byHand: { en: 'ticked by hand', ko: '수동 체크', ja: '手動チェック' },
  payoffCount: { en: 'payoffs', ko: '회수 지점', ja: '回収箇所' },
  settingsIncludeSheets: { en: 'Also scan sheets', ko: '시트도 검사', ja: 'シートも検査' },
  settingsIncludeSheetsHint: {
    en: 'Look for beats in sheets as well as documents.',
    ko: '문서뿐 아니라 시트에서도 복선을 찾습니다.',
    ja: 'ドキュメントに加えてシートからも伏線を探します。'
  },
  settingsStrike: {
    en: 'Strike through paid-off beats',
    ko: '회수한 복선에 취소선',
    ja: '回収済みに取り消し線'
  },
  settingsStrikeHint: {
    en: 'Paid-off beats stay in the list, struck through.',
    ko: '회수한 복선을 목록에서 취소선으로 표시합니다.',
    ja: '回収済みの伏線をリストに取り消し線付きで残します。'
  },
  settingsHighlight: {
    en: 'Highlight open beats in the text',
    ko: '본문에서 미회수 복선 강조',
    ja: '本文で未回収の伏線を強調'
  },
  settingsHighlightHint: {
    en: 'Dotted underline on planted sentences in the manuscript.',
    ko: '복선을 심은 문장에 점선 밑줄을 표시합니다.',
    ja: '伏線を置いた文に点線の下線を表示します。'
  },
  sectionDescription: {
    en: 'How much of what you set up has landed.',
    ko: '심어둔 복선 중 얼마나 회수했는지.',
    ja: '置いた伏線をどれだけ回収したか。'
  },
  statPlanted: { en: 'Planted', ko: '심은 복선', ja: '置いた伏線' },
  statResolved: { en: 'Paid off', ko: '회수', ja: '回収' },
  statOpen: { en: 'Still open', ko: '미회수', ja: '未回収' },
  noteScope: {
    en: 'Counted across the whole project, not the selected period.',
    ko: '선택한 기간이 아니라 프로젝트 전체 기준입니다.',
    ja: '選択期間ではなくプロジェクト全体の集計です。'
  }
} satisfies Record<string, LocalizedText>;

export type StringKey = keyof typeof STRINGS;

/** Bind the table to the host's current UI language. */
export function createT(app: HostApi): (key: StringKey) => string {
  return (key) => resolveLocalizedText(STRINGS[key], app.app.locale);
}

/** For places that want the raw `LocalizedText` (settings schema labels). */
export const text = STRINGS;
