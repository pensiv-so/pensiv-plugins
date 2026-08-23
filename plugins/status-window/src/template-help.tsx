/**
 * The template syntax reference, inline.
 *
 * The template box asks the writer to speak a small mustache dialect from
 * memory. This is the reference card beside it: ready-made line patterns with
 * an insert button, then every tag and every context field, one line each.
 *
 * It renders **inline under the textarea**, toggled by the 문법 button — not as
 * a host sheet. `app.ui.openSheet` has no host on the settings route (the
 * `PluginSheetHost` mounts inside the project layout only), so a sheet opened
 * from this tab would silently show nothing.
 *
 * The strings live here rather than in `i18n.ts`: they are reference content
 * with a fixed shape, not UI chrome, and forty keyed entries would drown the
 * string table.
 */
import * as React from 'react';
import { resolveLocalizedText, type HostApi, type LocalizedText } from '@pensiv/plugin-sdk';

interface HelpRow {
  code: string;
  text: LocalizedText;
}

interface SnippetRow {
  name: LocalizedText;
  snippet: string;
  text: LocalizedText;
}

/**
 * Whole line patterns, insertable at the caret — the fastest way to a working
 * template is to start from a line that already loops correctly.
 */
const SNIPPETS: SnippetRow[] = [
  {
    name: { en: 'One per line', ko: '속성 한 줄씩', ja: '1行に1項目' },
    snippet: '{{#attributes}}{{name}} : {{value}}\n{{/attributes}}',
    text: {
      en: 'Every attribute, one line each.',
      ko: '모든 속성을 줄마다 하나씩 출력합니다.',
      ja: '全項目を1行ずつ出力します。'
    }
  },
  {
    name: { en: 'Column rows', ko: '2열 행', ja: '2段の行' },
    snippet: '{{#rows}}{{#cells}}{{name}} : {{value}}{{^last}}   {{/last}}{{/cells}}\n{{/rows}}',
    text: {
      en: 'Laid out by the column setting; nothing after the last cell.',
      ko: '열 수 설정대로 잘라 배치합니다. 마지막 칸 뒤에는 구분자가 빠집니다.',
      ja: '段数の設定どおりに配置。最後のセルの後に区切りは付きません。'
    }
  },
  {
    name: { en: 'Grouped sections', ko: '그룹 묶음', ja: 'グループ見出し' },
    snippet: '{{#groups}}{{groupName}}\n{{#attributes}}{{rawName}} : {{value}}\n{{/attributes}}{{/groups}}',
    text: {
      en: 'A heading, then that group’s attributes.',
      ko: '그룹 제목 아래에 소속 속성을 출력합니다.',
      ja: '見出しの下に所属項目を出力します。'
    }
  },
  {
    name: { en: 'Only what changed', ko: '변한 값만', ja: '変化した値のみ' },
    snippet: '{{#changed}}{{rawName}} : {{arrow}}\n{{/changed}}',
    text: {
      en: 'Attributes that moved this episode, with the growth arrow.',
      ko: '이번 회차에 변한 속성만 성장 화살표와 함께.',
      ja: 'この話で変化した項目だけを矢印付きで。'
    }
  }
];

const SYNTAX: HelpRow[] = [
  {
    code: '{{value}}',
    text: {
      en: 'Prints one field where it stands.',
      ko: '필드 하나를 그 자리에 출력합니다.',
      ja: 'フィールドをその場に出力します。'
    }
  },
  {
    code: '{{#attributes}} … {{/attributes}}',
    text: {
      en: 'Repeats for each item of a list; skipped entirely when empty.',
      ko: '목록 개수만큼 반복합니다. 비어 있으면 통째로 생략됩니다.',
      ja: 'リストの数だけ繰り返します。空なら丸ごと省略。'
    }
  },
  {
    code: '{{^last}} … {{/last}}',
    text: {
      en: 'The inverse: rendered only when the field is empty or false.',
      ko: '반대로, 값이 없거나 거짓일 때만 출력됩니다 — 구분자를 마지막 칸에서 빼는 데 씁니다.',
      ja: '逆に、値がない・偽のときだけ出力 — 区切りを最後のセルで消すのに使います。'
    }
  },
  {
    code: '{{.}}',
    text: {
      en: 'The item itself, inside a loop over plain values.',
      ko: '반복 중인 항목 그 자체입니다.',
      ja: '繰り返し中の項目そのものです。'
    }
  },
  {
    code: '{{by.hp.value}}',
    text: {
      en: 'One attribute by its id — for lines that pack several fields.',
      ko: 'id로 특정 속성을 집어 씁니다 — 한 줄에 여러 필드를 배치할 때.',
      ja: 'idで特定の項目を指します — 1行に複数詰めるとき。'
    }
  },
  {
    code: '—',
    text: {
      en: 'A line holding only a section tag disappears from the output.',
      ko: '섹션 태그만 있는 줄은 출력에서 통째로 사라집니다.',
      ja: 'セクションタグだけの行は出力から消えます。'
    }
  }
];

const TOP_LEVEL: HelpRow[] = [
  { code: 'characterName', text: { en: 'The character’s name.', ko: '캐릭터 이름.', ja: 'キャラクター名。' } },
  { code: 'episodeTitle', text: { en: 'The open episode’s title.', ko: '현재 회차 제목.', ja: '現在の話のタイトル。' } },
  { code: 'episodeNumber', text: { en: 'Its position in the episode order.', ko: '회차 순서상의 번호.', ja: '話数。' } },
  {
    code: 'attributes',
    text: { en: 'Every attribute, flat, in sheet order.', ko: '모든 속성을 시트 순서대로 평평하게.', ja: '全項目をシート順に。' }
  },
  {
    code: 'groups',
    text: {
      en: 'Grouped attributes — each has groupName and its own attributes.',
      ko: '그룹 묶음 — 각각 groupName과 자기 attributes를 가집니다.',
      ja: 'グループ — 各groupNameと配下のattributesを持ちます。'
    }
  },
  {
    code: 'rows',
    text: {
      en: 'Attributes chunked by the column count — each row has cells.',
      ko: '열 수만큼 잘라 묶은 행 — 각 행이 cells를 가집니다.',
      ja: '段数で切った行 — 各行がcellsを持ちます。'
    }
  },
  {
    code: 'changed',
    text: {
      en: 'Only the attributes that moved since the previous episode.',
      ko: '이전 회차에서 값이 변한 속성만.',
      ja: '前話から変化した項目のみ。'
    }
  },
  { code: 'by', text: { en: 'Attributes by id — {{by.hp.value}}.', ko: 'id로 접근 — {{by.hp.value}}.', ja: 'idでアクセス — {{by.hp.value}}。' } }
];

const PER_ATTRIBUTE: HelpRow[] = [
  { code: 'name', text: { en: 'The name, padded for alignment.', ko: '이름 (정렬 패딩 포함).', ja: '名前（揃えの詰め込み）。' } },
  { code: 'rawName', text: { en: 'The name, unpadded.', ko: '이름 (패딩 없이).', ja: '名前（詰めなし）。' } },
  { code: 'value', text: { en: 'The formatted value — 415(+566)[D].', ko: '완성 포맷 값 — 415(+566)[D].', ja: '整形済みの値 — 415(+566)[D]。' } },
  { code: 'rawValue', text: { en: 'The value, unpadded.', ko: '값 (패딩 없이).', ja: '値（詰めなし）。' } },
  { code: 'arrow', text: { en: '14 [F] → 16(+2)[F] when it moved; just the value when it held.', ko: '변한 회차엔 14 [F] → 16(+2)[F], 아니면 값만.', ja: '変化時は 14 [F] → 16(+2)[F]、それ以外は値のみ。' } },
  { code: 'prev / delta', text: { en: 'Last episode’s value, and the difference.', ko: '이전 회차 값과 그 차이.', ja: '前話の値と差分。' } },
  { code: 'base / bonus', text: { en: 'A stat’s parts — 415 and +566.', ko: '능력치의 기본과 보정 — 415와 +566.', ja: '能力値の基本と補正。' } },
  { code: 'grade / note', text: { en: 'The grade letter and the note beside the bonus.', ko: '등급 글자와 보정 옆 주석.', ja: '等級と補正の注記。' } },
  { code: 'cur / max / regen', text: { en: 'A resource’s parts — 70/70 and 0.80.', ko: '자원의 현재/최대/재생.', ja: 'リソースの現在/最大/再生。' } },
  { code: 'percent / bar', text: { en: 'A gauge as 62% and ██████░░.', ko: '게이지의 62%와 ██████░░.', ja: 'ゲージの62%と██████░░。' } },
  { code: 'items', text: { en: 'A list attribute’s entries.', ko: '목록 속성의 항목들.', ja: 'リスト項目。' } },
  { code: 'pad', text: { en: 'Just the padding — {{rawName}}:{{pad}} puts it after the colon.', ko: '패딩만 — {{rawName}}:{{pad}} 로 콜론 뒤에 넣습니다.', ja: '詰めのみ — {{rawName}}:{{pad}} でコロンの後に。' } },
  { code: 'first / last', text: { en: 'True on the first / last cell — for separators.', ko: '첫/마지막 칸에서 참 — 구분자 처리용.', ja: '最初/最後のセルで真 — 区切り用。' } }
];

const HEADINGS: Record<'snippets' | 'syntax' | 'top' | 'attr', LocalizedText> = {
  snippets: { en: 'Snippets', ko: '스니펫', ja: 'スニペット' },
  syntax: { en: 'Tags', ko: '태그', ja: 'タグ' },
  top: { en: 'Top-level fields', ko: '최상위 필드', ja: 'トップレベル' },
  attr: { en: 'Per-attribute fields', ko: '속성 필드', ja: '項目ごとのフィールド' }
};

const Table: React.FC<{ rows: HelpRow[]; locale: string }> = ({ rows, locale }) => (
  <div className="pnsv-sw-help-table">
    {rows.map((row) => (
      <div key={row.code} className="pnsv-sw-help-row">
        <code className="pnsv-sw-help-code">{row.code}</code>
        <span className="pnsv-sw-help-desc">{resolveLocalizedText(row.text, locale)}</span>
      </div>
    ))}
  </div>
);

export const TemplateHelp: React.FC<{
  app: HostApi;
  insertLabel: string;
  onInsert: (snippet: string) => void;
}> = ({ app, insertLabel, onInsert }) => {
  const locale = app.app.locale;
  return (
    <div className="pnsv-sw-help">
      <h3 className="pnsv-sw-help-h">{resolveLocalizedText(HEADINGS.snippets, locale)}</h3>
      <div className="pnsv-sw-help-table">
        {SNIPPETS.map((row) => (
          <div key={row.snippet} className="pnsv-sw-help-row">
            <code className="pnsv-sw-help-code">{resolveLocalizedText(row.name, locale)}</code>
            <span className="pnsv-sw-help-desc">{resolveLocalizedText(row.text, locale)}</span>
            <button
              type="button"
              className="pnsv-sw-ghostbtn pnsv-sw-help-insert"
              onClick={() => onInsert(row.snippet)}
            >
              {insertLabel}
            </button>
          </div>
        ))}
      </div>
      <h3 className="pnsv-sw-help-h">{resolveLocalizedText(HEADINGS.syntax, locale)}</h3>
      <Table rows={SYNTAX} locale={locale} />
      <h3 className="pnsv-sw-help-h">{resolveLocalizedText(HEADINGS.top, locale)}</h3>
      <Table rows={TOP_LEVEL} locale={locale} />
      <h3 className="pnsv-sw-help-h">{resolveLocalizedText(HEADINGS.attr, locale)}</h3>
      <Table rows={PER_ATTRIBUTE} locale={locale} />
    </div>
  );
};
