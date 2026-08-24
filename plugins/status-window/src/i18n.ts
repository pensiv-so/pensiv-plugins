/**
 * Strings, resolved against `app.app.locale`.
 *
 * The same recipe as the Foreshadowing and Timer plugins: one table of
 * `LocalizedText`, one `t()` bound to the live locale. The host never translates
 * plugin strings — it resolves the ones it renders itself (manifest name, command
 * names, settings labels) and leaves the rest to us.
 *
 * Note what is *not* here: attribute names. `근력`, `腕力` and `STR` are the
 * writer's text, seeded by the preset they chose, and translating them would be
 * wrong in every direction.
 */
import { resolveLocalizedText, type HostApi, type LocalizedText } from '@pensiv/plugin-sdk';

const STRINGS = {
  /* ── the pane ─────────────────────────────────────────────────────────── */
  paneTitle: { en: 'Status window', ko: '상태창', ja: 'ステータス' },
  insert: { en: 'Insert into text', ko: '본문에 삽입', ja: '本文に挿入' },
  inserted: { en: 'Status window inserted', ko: '상태창을 삽입했습니다', ja: 'ステータスを挿入しました' },
  preview: { en: 'Preview', ko: '미리보기', ja: 'プレビュー' },
  edit: { en: 'Edit', ko: '편집', ja: '編集' },
  copy: { en: 'Copy', ko: '복사', ja: 'コピー' },
  copied: { en: 'Copied', ko: '복사했습니다', ja: 'コピーしました' },

  /* ── characters ───────────────────────────────────────────────────────── */
  character: { en: 'Character', ko: '캐릭터', ja: 'キャラクター' },
  addCharacter: { en: 'Add a character', ko: '캐릭터 추가', ja: 'キャラクターを追加' },
  newCharacter: { en: 'New character', ko: '새 캐릭터', ja: '新しいキャラクター' },
  characterNamePlaceholder: { en: 'Name', ko: '이름', ja: '名前' },
  written: { en: 'Written', ko: '작성됨', ja: '記入済み' },
  notWritten: { en: 'Add', ko: '추가하기', ja: '追加' },
  removeCharacter: { en: 'Remove character', ko: '캐릭터 삭제', ja: 'キャラクターを削除' },
  noCharacters: {
    en: 'No characters yet. Add one, or create a sheet in the project.',
    ko: '캐릭터가 없습니다. 하나 추가하거나 프로젝트에 시트를 만드세요.',
    ja: 'キャラクターがいません。追加するか、プロジェクトにシートを作成してください。'
  },

  /* ── attributes ───────────────────────────────────────────────────────── */
  addAttribute: { en: 'Add attribute', ko: '속성 추가', ja: '項目を追加' },
  attributeName: { en: 'Attribute name', ko: '속성 이름', ja: '項目名' },
  removeAttribute: { en: 'Remove', ko: '삭제', ja: '削除' },
  inherited: {
    en: 'Carried over from the previous episode',
    ko: '이전 회차에서 이어받음',
    ja: '前話から引き継ぎ'
  },
  changedHere: { en: 'Changed in this episode', ko: '이번 회차에서 변경됨', ja: 'この話で変更' },
  revert: { en: 'Carry over instead', ko: '이어받기로 되돌리기', ja: '引き継ぎに戻す' },

  /* attribute kinds — the labels in the "add attribute" picker */
  kindText: { en: 'Text', ko: '텍스트', ja: 'テキスト' },
  kindNumber: { en: 'Number', ko: '숫자', ja: '数値' },
  kindStat: { en: 'Stat (base + bonus)', ko: '능력치 (기본+보정)', ja: '能力値 (基本+補正)' },
  kindResource: { en: 'Resource (cur/max)', ko: '자원 (현재/최대)', ja: 'リソース (現在/最大)' },
  kindGauge: { en: 'Gauge (progress %)', ko: '게이지 (진척도 %)', ja: 'ゲージ (進捗 %)' },
  kindRank: { en: 'Rank', ko: '등급', ja: 'ランク' },
  kindList: { en: 'List', ko: '목록', ja: 'リスト' },

  /* field labels inside a row editor */
  fieldBase: { en: 'Base', ko: '기본', ja: '基本' },
  fieldBonus: { en: 'Bonus', ko: '보정', ja: '補正' },
  fieldGrade: { en: 'Grade', ko: '등급', ja: '等級' },
  fieldNote: { en: 'Note', ko: '주석', ja: '注記' },
  fieldCur: { en: 'Current', ko: '현재', ja: '現在' },
  fieldMax: { en: 'Max', ko: '최대', ja: '最大' },
  fieldRegen: { en: 'Regen', ko: '재생', ja: '再生' },
  fieldUnit: { en: 'Unit', ko: '단위', ja: '単位' },
  fieldItems: { en: 'One per line', ko: '한 줄에 하나씩', ja: '1行に1つ' },

  /* ── groups ───────────────────────────────────────────────────────────── */
  addGroup: { en: 'Add group', ko: '그룹 추가', ja: 'グループを追加' },
  ungrouped: { en: 'General', ko: '기본', ja: '基本' },
  groupName: { en: 'Group name', ko: '그룹 이름', ja: 'グループ名' },

  /* ── the attribute library ────────────────────────────────────────────── */
  attributeLibrary: { en: 'Attribute library', ko: '속성 라이브러리', ja: '項目ライブラリ' },
  attributeLibraryHint: {
    en: 'Ready-made rows offered in "Add attribute". These are examples — edit the list to match your own system.',
    ko: '"속성 추가"에 나오는 미리 만들어진 행입니다. 예시일 뿐이니 쓰는 체계에 맞게 목록을 고치세요.',
    ja: '「項目を追加」に出る既製の行です。例にすぎないので、自分の体系に合わせて編集してください。'
  },
  libraryNewEntry: { en: 'New attribute', ko: '새 속성', ja: '新しい項目' },
  libraryLabel: { en: 'Label in the picker', ko: '목록에 보일 이름', ja: '一覧に表示する名前' },
  dragToReorder: { en: 'Drag to reorder', ko: '끌어서 순서 변경', ja: 'ドラッグで並べ替え' },
  fieldDescription: { en: 'Description', ko: '설명', ja: '説明' },
  fieldKind: { en: 'Type', ko: '유형', ja: '種類' },
  fieldGrades: { en: 'Grade ladder', ko: '등급 사다리', ja: '等級の段階' },
  gradesHint: {
    en: 'Comma-separated, low to high — F, E, D…',
    ko: '낮은 것부터 콤마로 구분 — F, E, D…',
    ja: '低い順にカンマ区切り — F、E、D…'
  },
  /* short kind names, for badges — the full ones carry a parenthetical */
  kindShortStat: { en: 'Stat', ko: '능력치', ja: '能力値' },
  kindShortResource: { en: 'Resource', ko: '자원', ja: 'リソース' },
  kindShortGauge: { en: 'Gauge', ko: '게이지', ja: 'ゲージ' },
  saveToLibrary: { en: 'Save to library', ko: '라이브러리에 추가', ja: 'ライブラリに追加' },
  savedToLibrary: { en: 'Saved to library', ko: '라이브러리에 추가했습니다', ja: 'ライブラリに追加しました' },
  removeFromLibrary: { en: 'Remove from library', ko: '라이브러리에서 삭제', ja: 'ライブラリから削除' },
  duplicateEntry: { en: 'Duplicate', ko: '복제', ja: '複製' },
  blankRow: { en: 'Blank row', ko: '빈 행', ja: '空の行' },
  restoreDefaults: { en: 'Restore defaults', ko: '기본값 복원', ja: '既定に戻す' },
  restoreConfirm: {
    en: 'Replace the list with the built-in examples? Anything you added or edited is lost.',
    ko: '목록을 기본 예시로 되돌릴까요? 추가하거나 수정한 항목은 사라집니다.',
    ja: '一覧を既定の例に戻しますか？追加・編集したものは失われます。'
  },

  /* ── presets and templates ────────────────────────────────────────────── */
  preset: { en: 'Preset', ko: '프리셋', ja: 'プリセット' },
  presets: { en: 'Presets', ko: '프리셋', ja: 'プリセット' },
  presetsHint: {
    en: 'The conventions you can render a status window in. These are examples — add your own, edit them, delete the ones you never use.',
    ko: '상태창을 뽑을 표기 관례 목록입니다. 예시일 뿐이니 직접 추가하고, 고치고, 안 쓰는 건 지우세요.',
    ja: 'ステータスを出力する表記の一覧です。例にすぎないので、追加・編集・削除して構いません。'
  },
  newPreset: { en: 'New preset', ko: '새 프리셋', ja: '新しいプリセット' },
  duplicatePreset: { en: 'Duplicate', ko: '복제', ja: '複製' },
  deletePreset: { en: 'Delete preset', ko: '프리셋 삭제', ja: 'プリセットを削除' },
  presetNameLabel: { en: 'Preset name', ko: '프리셋 이름', ja: 'プリセット名' },
  presetNameHint: {
    en: 'What this convention is called in the picker.',
    ko: '목록에서 이 표기 관례를 부를 이름입니다.',
    ja: '一覧でこの表記を呼ぶ名前です。'
  },
  presetActions: { en: 'Manage', ko: '관리', ja: '管理' },
  presetActionsHint: {
    en: 'Duplicate to make a variant of this preset, or delete it.',
    ko: '복제해서 이 프리셋의 변형을 만들거나, 삭제합니다.',
    ja: '複製して変形を作るか、削除します。'
  },
  exampleLine: { en: 'Example', ko: '예시', ja: '例' },
  makeDefault: { en: 'Use as default', ko: '기본으로 지정', ja: '既定にする' },
  isDefault: { en: 'Default', ko: '기본', ja: '既定' },
  copySuffix: { en: 'copy', ko: '복사본', ja: 'コピー' },

  /* per-preset convention options */
  optLayout: { en: 'Layout', ko: '배치', ja: 'レイアウト' },
  optColumns: { en: 'Columns', ko: '열 수', ja: '段数' },
  optColumnsHint: {
    en: 'How many attributes share one line.',
    ko: '한 줄에 속성을 몇 개씩 배치할지.',
    ja: '1行に並べる項目の数。'
  },
  optAlign: { en: 'Align names', ko: '이름 정렬', ja: '項目名を揃える' },
  optAlignHint: {
    en: 'Pad names so the colons line up.',
    ko: '이름 뒤를 채워 콜론 위치를 맞춥니다.',
    ja: '項目名の後を詰めてコロンの位置を揃えます。'
  },
  optAlignValues: { en: 'Align values', ko: '값 정렬', ja: '値を揃える' },
  optAlignValuesHint: {
    en: 'Pad values too, so a second column starts on a straight edge.',
    ko: '값 뒤도 채워 2열일 때 두 번째 열의 시작을 맞춥니다.',
    ja: '値の後も詰めて、2段目の頭を揃えます。'
  },
  optPadChar: { en: 'Padding', ko: '채움 문자', ja: '詰め文字' },
  optPadCharHint: {
    en: 'The character used to align — fullwidth space for the Japanese style.',
    ko: '정렬에 쓰는 문자. 일본식은 전각 공백을 씁니다.',
    ja: '揃えに使う文字。日本式は全角空白。'
  },
  padSpace: { en: 'Space', ko: '반각 공백', ja: '半角空白' },
  padIdeographic: { en: 'Ideographic (　)', ko: '전각 공백 (　)', ja: '全角空白 (　)' },
  optNumbers: { en: 'Numbers', ko: '숫자', ja: '数値' },
  optThousands: { en: 'Group thousands (1,240)', ko: '천 단위 콤마 (1,240)', ja: '桁区切り (1,240)' },
  optThousandsHint: {
    en: 'The LitRPG convention — off for Korean and Japanese sheets.',
    ko: '미국식 표기입니다. 한국식·일본식은 끕니다.',
    ja: '英語圏の表記。韓国式・日本式ではオフ。'
  },
  optListJoin: { en: 'List separator', ko: '목록 구분자', ja: 'リスト区切り' },
  optListJoinHint: {
    en: 'What separates the items of a list attribute.',
    ko: '목록 속성의 항목 사이에 들어가는 구분자.',
    ja: 'リスト項目の間に入る区切り。'
  },
  optArrow: { en: 'Growth arrow', ko: '성장 화살표', ja: '成長の矢印' },
  optArrowHint: {
    en: 'Printed between the old and new value — `14 → 16(+2)`.',
    ko: '값이 변한 회차에서 이전 값과 새 값 사이에 들어갑니다 — `14 → 16(+2)`.',
    ja: '変化した話で新旧の値の間に入ります — `14 → 16(+2)`。'
  },
  optRegenLabel: { en: 'Regen word', ko: '재생 표기', ja: '再生の語' },
  optRegenSuffix: { en: 'Regen unit', ko: '재생 단위', ja: '再生の単位' },
  optBar: { en: 'Progress bar', ko: '진행 바', ja: '進捗バー' },
  optBarWidth: { en: 'Bar width', ko: '바 길이', ja: 'バーの長さ' },
  optBarWidthHint: {
    en: 'Cells in a gauge bar — `██████░░`. 0 draws none.',
    ko: '게이지 진행 바의 칸 수 — `██████░░`. 0이면 그리지 않습니다.',
    ja: 'ゲージバーのマス数 — `██████░░`。0で非表示。'
  },
  optRegenHint: {
    en: 'The word and unit around a resource’s regeneration — `70/70 재생 0.80/분`.',
    ko: '자원의 재생 수치를 감싸는 말과 단위 — `70/70 재생 0.80/분`.',
    ja: 'リソースの再生値を囲む語と単位 — `70/70 再生 0.80/分`。'
  },
  customValue: { en: 'Custom…', ko: '직접 입력…', ja: '直接入力…' },
  libraryEmpty: {
    en: 'Empty. The seven blank kinds are still offered under "Add attribute".',
    ko: '비어 있습니다. "속성 추가"에는 7종 빈 행이 그대로 있습니다.',
    ja: '空です。「項目を追加」には7種類の空の行が残っています。'
  },
  template: { en: 'Template', ko: '템플릿', ja: 'テンプレート' },
  templateHelp: { en: 'Syntax', ko: '문법', ja: '構文' },
  insertSnippet: { en: 'Insert', ko: '삽입', ja: '挿入' },
  templateSettings: { en: 'Template settings', ko: '템플릿 설정', ja: 'テンプレート設定' },
  resetTemplate: { en: 'Reset to preset', ko: '기본 템플릿', ja: '既定のテンプレート' },
  templateHint: {
    en: 'Use {{characterName}}, {{episodeTitle}} and the {{#attributes}} loop.',
    ko: '{{characterName}}, {{episodeTitle}}, {{#attributes}} 반복 단락을 사용할 수 있어요.',
    ja: '{{characterName}}、{{episodeTitle}}、{{#attributes}} 繰り返しが使えます。'
  },
  applyPresetFields: {
    en: "Replace this character's attributes with the preset's",
    ko: '이 캐릭터의 속성을 프리셋 것으로 교체',
    ja: 'このキャラクターの項目をプリセットのものに置き換える'
  },
  applyPresetFieldsConfirm: {
    en: 'Replace every attribute on this sheet? Values recorded per episode are kept.',
    ko: '이 시트의 속성을 모두 교체할까요? 회차별로 기록한 값은 유지됩니다.',
    ja: 'このシートの項目をすべて置き換えますか？話ごとに記録した値は残ります。'
  },

  /* ── system messages ──────────────────────────────────────────────────── */
  systemMessage: { en: 'System message', ko: '시스템 메시지', ja: 'システムメッセージ' },
  systemLinesPlaceholder: {
    en: 'Level up!\nAttribute points (1)',
    ko: '레벨 업!\n능력치 포인트 (1)',
    ja: 'レベルアップ！\n能力値ポイント (1)'
  },

  /* ── live blocks ──────────────────────────────────────────────────────── */
  refreshBlocks: {
    en: 'Refresh status windows in this episode',
    ko: '이 회차의 상태창 갱신',
    ja: 'この話のステータスを更新'
  },
  refreshed: { en: 'Refreshed {n}', ko: '{n}개를 갱신했습니다', ja: '{n}件を更新しました' },
  nothingToRefresh: {
    en: 'No live status windows in this episode',
    ko: '이 회차에 갱신할 상태창이 없습니다',
    ja: 'この話に更新するステータスはありません'
  },
  flatten: {
    en: 'Convert status windows to plain text',
    ko: '상태창을 평문으로 변환',
    ja: 'ステータスをプレーンテキストに変換'
  },
  flattened: {
    en: 'Converted to plain text',
    ko: '평문으로 변환했습니다',
    ja: 'プレーンテキストに変換しました'
  },
  editThisBlock: { en: 'Edit this status window', ko: '이 상태창 편집', ja: 'このステータスを編集' },

  /* ── failures ─────────────────────────────────────────────────────────── */
  cannotInsertHere: {
    en: "This view can't take a status window. Open the document on its own tab.",
    ko: '이 화면에는 상태창을 넣을 수 없습니다. 문서를 탭으로 열어 주세요.',
    ja: 'この画面にはステータスを挿入できません。ドキュメントをタブで開いてください。'
  },
  noEpisode: {
    en: 'Open an episode to write a status window.',
    ko: '상태창을 작성하려면 회차를 여세요.',
    ja: 'ステータスを書くには話を開いてください。'
  },
  templateError: { en: 'Template error', ko: '템플릿 오류', ja: 'テンプレートエラー' },

  /* ── settings ─────────────────────────────────────────────────────────── */
  settingsPreset: { en: 'Default preset', ko: '기본 프리셋', ja: '既定のプリセット' },
  settingsPresetHint: {
    en: 'The convention new characters and new blocks start from.',
    ko: '새 캐릭터와 새 블록이 시작할 표기 관례입니다.',
    ja: '新しいキャラクターやブロックが使う表記の既定です。'
  },
  settingsOmitEmpty: { en: 'Omit empty rows', ko: '빈 값 제외', ja: '空の項目を除く' },
  settingsOmitEmptyHint: {
    en: 'Leave out attributes with no value. Zero still prints — `자유 스텟 : 0` is a real line.',
    ko: '값이 없는 속성을 빼고 출력합니다. 0은 그대로 출력됩니다 — `자유 스텟 : 0`은 의미 있는 줄입니다.',
    ja: '値のない項目を出力しません。0 はそのまま出力されます。'
  },
  settingsLiveBlocks: { en: 'Live status windows', ko: '라이브 상태창', ja: 'ライブステータス' },
  settingsLiveBlocksHint: {
    en: 'Tag inserted blocks so they can be refreshed in place. The text stays plain either way, and turning this off leaves existing blocks alone.',
    ko: '삽입한 블록에 표시를 남겨 제자리 갱신을 가능하게 합니다. 어느 쪽이든 본문은 평문이며, 꺼도 기존 블록은 그대로입니다.',
    ja: '挿入したブロックに印を付け、その場で更新できるようにします。どちらでも本文はプレーンテキストのままです。'
  },
  settingsScope: { en: 'Episode order', ko: '회차 범위', ja: '話の範囲' },
  settingsScopeHint: {
    en: 'Which documents count as the episode sequence that stats carry through.',
    ko: '능력치가 이어지는 회차 순서로 볼 문서의 범위입니다.',
    ja: '能力値が引き継がれる話の並びとして扱う範囲です。'
  },
  scopeFolder: { en: 'This folder', ko: '현재 폴더', ja: 'このフォルダ' },
  scopeProject: { en: 'Whole project', ko: '프로젝트 전체', ja: 'プロジェクト全体' },
  settingsAutoRefresh: {
    en: 'Refresh blocks when stats change',
    ko: '능력치 변경 시 블록 자동 갱신',
    ja: '能力値の変更時にブロックを自動更新'
  },
  settingsAutoRefreshHint: {
    en: 'Rewrite live status windows in the open episode as soon as a value is edited.',
    ko: '값을 편집하면 열려 있는 회차의 라이브 상태창을 즉시 다시 씁니다.',
    ja: '値を編集すると、開いている話のライブステータスをすぐに書き直します。'
  }
} satisfies Record<string, LocalizedText>;

export type StringKey = keyof typeof STRINGS;

/** The raw table, for settings-schema labels the host resolves itself. */
export const text = STRINGS;

/** Bind a translator to the app's live locale. */
export function createT(app: HostApi): (key: StringKey) => string {
  return (key) => resolveLocalizedText(STRINGS[key], app.app.locale);
}

/** `{n}` substitution, for the one or two strings that need a count. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  );
}
