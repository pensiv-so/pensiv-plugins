/**
 * Seed data — the six conventions, transcribed.
 *
 * ## These are defaults, not the product
 *
 * Everything in this file is **starting content**, copied into the writer's own
 * storage the first time they open the plugin. From then on the presets are
 * theirs: add, edit, duplicate, delete. Nothing here is privileged at runtime,
 * and "restore defaults" simply copies this file in again.
 *
 * That matters because a status window is a house style. Six transcriptions of
 * other people's serials are a good place to start and a bad place to stop —
 * the writer's own convention is the one that has to be expressible.
 *
 * ## A preset is a whole convention
 *
 * Not just a template string. The lineages differ in separator, padding
 * character, column count, list punctuation and whether numbers are grouped —
 * set any of those wrong and the output reads foreign. So all of it is on the
 * preset, and all of it is editable.
 *
 * Sources for every field list and delimiter: `docs/status-window-formats.md`
 * in the app repo. Nothing here is invented.
 */
import type { LocalizedText } from '@pensiv/plugin-sdk';
import { DEFAULT_FORMAT, type FormatOptions } from './format';
import type { AttributeDef, AttributeGroup, AttributeKind } from './model';

export interface Preset {
  id: string;
  name: LocalizedText;
  /** Which tradition this belongs to — groups the picker. */
  family: 'ko' | 'ja' | 'en';
  template: string;
  format: FormatOptions;
  columns: 1 | 2;
  align: boolean;
  alignValues: boolean;
  padChar: string;
  /** Rows a new character starts with. */
  fields: AttributeDef[];
  groups: AttributeGroup[];
}

/** F..SSS — the ladder nearly every Korean growth serial uses. */
const GRADES = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];

/** Terse constructor — these lists are long and the noise would bury them. */
const def = (
  id: string,
  name: string,
  kind: AttributeKind,
  extra: Partial<AttributeDef> = {}
): AttributeDef => ({ id, name, kind, ...extra });

// ── 한국식 · 게임판타지 ──────────────────────────────────────────────────────
// 달빛조각사 (2007~), the origin of the Korean status window. Seventeen fields,
// two columns, space-aligned.

const KO_CLASSIC_FIELDS: AttributeDef[] = [
  def('name', '캐릭터 이름', 'text'),
  def('alignment', '성향', 'text'),
  def('level', '레벨', 'number'),
  def('job', '직업', 'text'),
  def('title', '칭호', 'text'),
  def('fame', '명성', 'number'),
  def('hp', '생명력', 'number'),
  def('mp', '마나', 'number'),
  def('str', '힘', 'stat'),
  def('agi', '민첩', 'stat'),
  def('vit', '체력', 'stat'),
  def('wis', '지혜', 'stat'),
  def('lead', '통솔력', 'stat'),
  def('luck', '행운', 'stat'),
  def('atk', '공격력', 'stat'),
  def('def', '방어력', 'stat'),
  def('mres', '마법 저항', 'text')
];

// ── 한국식 · 헌터물 ─────────────────────────────────────────────────────────
// 나 혼자만 레벨업 (2016~). Pared down, pipe-separated two columns, and the
// leftover-points line every hunter serial carries.

const KO_HUNTER_FIELDS: AttributeDef[] = [
  def('name', '이름', 'text'),
  def('level', '레벨', 'number'),
  def('job', '직업', 'text'),
  def('fatigue', '피로도', 'number'),
  def('hp', 'HP', 'number'),
  def('mp', 'MP', 'number'),
  def('str', '근력', 'stat'),
  def('vit', '체력', 'stat'),
  def('agi', '민첩', 'stat'),
  def('int', '지능', 'stat'),
  def('sen', '감각', 'stat'),
  def('ap', 'AP', 'number')
];

// ── 한국식 · 성장물 ─────────────────────────────────────────────────────────
// The modern growth serial: equipment bonuses in parens, a grade letter per
// stat, and the arrow that makes a level-up scene worth printing.

const KO_GROWTH_FIELDS: AttributeDef[] = [
  def('id', '아이디', 'text'),
  def('class', '클래스', 'text'),
  def('title', '칭호', 'text'),
  def('level', '레벨', 'number'),
  def('str', '근력', 'stat', { grades: GRADES }),
  def('vit', '체력', 'stat', { grades: GRADES }),
  def('hp', '생명력', 'stat', { grades: GRADES }),
  def('agi', '민첩', 'stat', { grades: GRADES }),
  def('mp', '마나', 'stat', { grades: GRADES }),
  def('mpow', '마나력', 'stat', { grades: GRADES }),
  def('mres', '항마력', 'stat', { grades: GRADES }),
  def('rec', '회복력', 'stat', { grades: GRADES }),
  def('free', '자유 스텟', 'number'),
  def('state', '상태', 'text')
];

// ── 일본식 · Type 1 (정통 RPG) ──────────────────────────────────────────────
// Fullwidth colon and fullwidth space throughout — the single most recognisable
// difference from the Korean sheets, and the thing a naive implementation gets
// wrong.

const JA_CLASSIC_FIELDS: AttributeDef[] = [
  def('name', '名前', 'text'),
  def('race', '種族', 'text'),
  def('level', 'レベル', 'number'),
  def('job', '職業', 'text'),
  def('hp', 'HP', 'resource'),
  def('mp', 'MP', 'resource'),
  def('str', '腕力', 'stat'),
  def('leg', '脚力', 'stat'),
  def('vit', '体力', 'stat'),
  def('agi', '敏捷', 'stat'),
  def('dex', '器用', 'stat'),
  def('mnd', '精神', 'stat'),
  def('equip', '装備', 'list'),
  def('skill', 'スキル', 'list')
];

// ── 일본식 · Type 2 (미니멀) ────────────────────────────────────────────────
// Type 2 is not Type 1 with a shorter template — it drops the numbers entirely.
// The source shows a name, a job, equipment and skills, and nothing else: it is
// for fantasy worlds where a full stat readout would break the tone.

const JA_MINIMAL_FIELDS: AttributeDef[] = [
  def('job', '職業', 'text'),
  def('equip', '装備', 'list'),
  def('skill', 'スキル', 'list'),
  def('title', '称号', 'list'),
  def('bless', '加護', 'list')
];

// ── 미국식 ──────────────────────────────────────────────────────────────────
// LitRPG / Royal Road. Three-letter caps, an XP gauge, comma-grouped numbers.

const EN_FIELDS: AttributeDef[] = [
  def('name', 'Name', 'text'),
  def('class', 'Class', 'text'),
  def('level', 'Level', 'number'),
  def('xp', 'Experience', 'gauge', { unit: 'XP' }),
  def('hp', 'Health', 'resource'),
  def('mp', 'Mana', 'resource'),
  def('str', 'STR', 'stat'),
  def('dex', 'DEX', 'stat'),
  def('con', 'CON', 'stat'),
  def('int', 'INT', 'stat'),
  def('wis', 'WIS', 'stat'),
  def('cha', 'CHA', 'stat'),
  def('skills', 'Skills', 'list', { groupId: 'g-skills' }),
  def('titles', 'Titles', 'list', { groupId: 'g-skills' })
];

const KO_FORMAT: FormatOptions = { ...DEFAULT_FORMAT, thousands: false, listJoin: ', ' };

const JA_FORMAT: FormatOptions = {
  ...DEFAULT_FORMAT,
  thousands: false,
  regenLabel: '再生',
  regenSuffix: '/分',
  listJoin: '、'
};

const EN_FORMAT: FormatOptions = {
  ...DEFAULT_FORMAT,
  thousands: true,
  regenLabel: 'regen',
  regenSuffix: '/min',
  listJoin: ', '
};

export const PRESETS: Preset[] = [
  {
    id: 'ko-classic',
    name: {
      en: 'Korean · game fantasy',
      ko: '한국식 · 게임판타지',
      ja: '韓国式 · ゲームファンタジー'
    },
    family: 'ko',
    columns: 2,
    align: true,
    // Both halves: in a two-column sheet the *second* column can only start on a
    // straight edge if the first column's values are padded too. Names alone
    // leave `레벨 : 1   직업` sitting left of `캐릭터 이름 : 위드   성향`.
    alignValues: true,
    padChar: ' ',
    format: KO_FORMAT,
    fields: KO_CLASSIC_FIELDS,
    groups: [],
    template: [
      '=====',
      '{{#rows}}{{#cells}}{{name}} : {{value}}{{^last}}   {{/last}}{{/cells}}',
      '{{/rows}}====='
    ].join('\n')
  },
  {
    id: 'ko-hunter',
    name: { en: 'Korean · hunter', ko: '한국식 · 헌터물', ja: '韓国式 · ハンター' },
    family: 'ko',
    columns: 2,
    align: false,
    alignValues: false,
    padChar: ' ',
    format: KO_FORMAT,
    fields: KO_HUNTER_FIELDS,
    groups: [],
    // The pipe belongs *between* cells, so `{{^last}}` guards it — otherwise
    // every line ends in a dangling `|`.
    template: [
      '=====',
      '{{#rows}}{{#cells}}{{rawName}}: {{value}}{{^last}} | {{/last}}{{/cells}}',
      '{{/rows}}====='
    ].join('\n')
  },
  {
    id: 'ko-growth',
    name: { en: 'Korean · growth serial', ko: '한국식 · 성장물', ja: '韓国式 · 成長もの' },
    family: 'ko',
    columns: 2,
    align: true,
    alignValues: true,
    padChar: ' ',
    format: KO_FORMAT,
    fields: KO_GROWTH_FIELDS,
    groups: [],
    // `{{arrow}}` rather than `{{value}}`: on an episode where the stat moved it
    // prints `14 [F] → 16(+2)[F]`, and on one where it held it prints the value
    // alone. That is the whole reason this lineage exists.
    template: [
      '=====',
      '{{#rows}}{{#cells}}{{name}} : {{arrow}}{{^last}}   {{/last}}{{/cells}}',
      '{{/rows}}{{#groups}}',
      '{{groupName}}',
      '{{#attributes}}[{{rawName}}] : {{value}}',
      '{{/attributes}}{{/groups}}====='
    ].join('\n')
  },
  {
    id: 'ja-classic',
    name: { en: 'Japanese · classic RPG', ko: '일본식 · 정통 RPG', ja: '日本式 · 王道RPG' },
    family: 'ja',
    columns: 1,
    align: false,
    alignValues: false,
    padChar: '　',
    format: JA_FORMAT,
    fields: JA_CLASSIC_FIELDS,
    groups: [],
    template: [
      '【ステータス】',
      '{{#attributes}}{{rawName}}：{{value}}',
      '{{/attributes}}{{#groups}}〈{{groupName}}〉',
      '{{#attributes}}・{{rawName}}：{{value}}',
      '{{/attributes}}{{/groups}}'
    ].join('\n')
  },
  {
    id: 'ja-minimal',
    name: { en: 'Japanese · minimal', ko: '일본식 · 미니멀', ja: '日本式 · ミニマル' },
    family: 'ja',
    columns: 1,
    // Type 2 does *not* align its labels — `職業：` and `スキル：` both start at
    // column 0 and the colons land where they land. Padding them would be an
    // improvement on the source, which is not what a preset is for.
    align: false,
    alignValues: false,
    padChar: '　',
    format: JA_FORMAT,
    fields: JA_MINIMAL_FIELDS,
    groups: [],
    // The name stands alone on the first line — Type 2's signature.
    template: ['{{characterName}}', '{{#attributes}}{{rawName}}：{{value}}', '{{/attributes}}'].join(
      '\n'
    )
  },
  {
    id: 'en-litrpg',
    name: { en: 'LitRPG', ko: '미국식 · LitRPG', ja: '米国式 · LitRPG' },
    family: 'en',
    columns: 1,
    align: true,
    alignValues: false,
    padChar: ' ',
    format: EN_FORMAT,
    fields: EN_FIELDS,
    groups: [{ id: 'g-skills', name: 'Skills & Titles', order: 1 }],
    // `{{rawName}}:{{pad}}` — the colon hugs the label and the padding follows
    // it (`Name:       Silas`). `{{name}}:` would pad *before* the colon and
    // give `Name      : Silas`, which is the Korean convention, not this one.
    template: [
      '[ Status ]',
      '{{#attributes}}{{rawName}}:{{pad}} {{value}}{{#bar}}  [{{bar}}]{{/bar}}',
      '{{/attributes}}{{#groups}}',
      '── {{groupName}} ──',
      '{{#attributes}}{{rawName}}: {{value}}',
      '{{/attributes}}{{/groups}}'
    ].join('\n')
  }
];

export const DEFAULT_PRESET_ID = 'ko-hunter';

/**
 * Look one up in the seed data.
 *
 * Runtime code goes through `library.ts` instead — the writer's list is what
 * matters there, and it may not contain this id at all. This is for tests and
 * for restoring defaults.
 */
export function presetById(id: string): Preset {
  return PRESETS.find((preset) => preset.id === id) ?? (PRESETS[1] as Preset);
}

// ── attribute examples ──────────────────────────────────────────────────────

/**
 * A ready-made row, offered in "add attribute".
 *
 * The seven {@link AttributeKind}s are engine-level — each has its own
 * formatter, and a writer can't author a new one. What they *can* own is the
 * library of named rows built on top of them, which is what this is: `근력` is
 * "a stat with an F–SSS ladder", `경험치` is "a gauge measured in XP". Picking
 * one gives a row that is already named and already configured, instead of a
 * blank of an abstract type.
 *
 * Seeded from the same serials as the presets, and editable the same way: add
 * your own from any row you've built, delete the ones your genre never uses.
 */
export interface AttributeTemplate {
  id: string;
  /** Shown in the picker. The writer's own entries carry a plain string. */
  label: LocalizedText;
  /**
   * One line under the label — what the row is for, and any convention it
   * carries (`0도 그대로 출력됩니다`). The writer's own entries start blank.
   */
  description?: LocalizedText;
  /** Groups the picker. `any` shows everywhere. */
  family: 'ko' | 'ja' | 'en' | 'any';
  /** Everything but the id, which is minted when the row is added. */
  def: Omit<AttributeDef, 'id'>;
}

const tpl = (
  id: string,
  label: LocalizedText,
  family: AttributeTemplate['family'],
  def: Omit<AttributeDef, 'id'>,
  description?: LocalizedText
): AttributeTemplate => ({ id, label, family, def, description });

export const DEFAULT_ATTRIBUTE_TEMPLATES: AttributeTemplate[] = [
  // Korean — the hunter/growth vocabulary.
  tpl(
    't-ko-str',
    { en: '근력 — stat', ko: '근력 (능력치)', ja: '筋力 (能力値)' },
    'ko',
    { name: '근력', kind: 'stat', grades: GRADES },
    {
      en: 'Raw physical power. Carries an F–SSS grade beside the number.',
      ko: '물리적인 힘. 숫자 옆에 F–SSS 등급이 함께 붙습니다.',
      ja: '物理的な力。数値の横にF–SSSの等級が付きます。'
    }
  ),
  tpl(
    't-ko-agi',
    { en: '민첩 — stat', ko: '민첩 (능력치)', ja: '敏捷 (能力値)' },
    'ko',
    { name: '민첩', kind: 'stat', grades: GRADES },
    {
      en: 'Speed and evasion, with an F–SSS grade.',
      ko: '이동과 회피의 빠르기. F–SSS 등급 포함.',
      ja: '移動と回避の速さ。F–SSSの等級付き。'
    }
  ),
  tpl(
    't-ko-vit',
    { en: '체력 — stat', ko: '체력 (능력치)', ja: '体力 (能力値)' },
    'ko',
    { name: '체력', kind: 'stat', grades: GRADES },
    {
      en: 'Endurance and toughness, with an F–SSS grade.',
      ko: '지구력과 몸의 튼튼함. F–SSS 등급 포함.',
      ja: '持久力と頑丈さ。F–SSSの等級付き。'
    }
  ),
  tpl(
    't-ko-hp',
    { en: '생명력 — resource', ko: '생명력 (자원)', ja: '生命力 (リソース)' },
    'ko',
    { name: '생명력', kind: 'resource' },
    {
      en: 'Current/max with a regen rate — `70/70 재생 0.80/분`.',
      ko: '현재/최대에 재생 속도를 같이 적는 자원 — `70/70 재생 0.80/분`.',
      ja: '現在/最大と再生速度を書くリソース — `70/70 再生 0.80/分`。'
    }
  ),
  tpl(
    't-ko-mp',
    { en: '마나 — resource', ko: '마나 (자원)', ja: 'マナ (リソース)' },
    'ko',
    { name: '마나', kind: 'resource' },
    {
      en: 'The casting resource, written as current/max.',
      ko: '스킬을 쓰는 자원. 현재/최대로 적습니다.',
      ja: 'スキルを使うリソース。現在/最大で書きます。'
    }
  ),
  tpl(
    't-ko-level',
    { en: '레벨 — number', ko: '레벨 (숫자)', ja: 'レベル (数値)' },
    'ko',
    { name: '레벨', kind: 'number' },
    {
      en: 'A single number.',
      ko: '숫자 하나로 적는 단계.',
      ja: '数値ひとつで書く段階。'
    }
  ),
  tpl(
    't-ko-free',
    { en: '자유 스텟 — number', ko: '자유 스텟 (숫자)', ja: '自由ステータス (数値)' },
    'ko',
    { name: '자유 스텟', kind: 'number' },
    {
      en: 'Unspent points. Zero still prints — it is a real line.',
      ko: '아직 배분하지 않은 포인트. 0도 의미 있는 줄이라 그대로 출력됩니다.',
      ja: '未配分のポイント。0でもそのまま出力されます。'
    }
  ),
  tpl(
    't-ko-title',
    { en: '칭호 — text', ko: '칭호 (텍스트)', ja: '称号 (テキスト)' },
    'ko',
    { name: '칭호', kind: 'text' },
    {
      en: 'A short earned title.',
      ko: '얻은 칭호를 짧은 문구로 적습니다.',
      ja: '得た称号を短い語で書きます。'
    }
  ),
  tpl(
    't-ko-state',
    { en: '상태 — text', ko: '상태 (텍스트)', ja: '状態 (テキスト)' },
    'ko',
    { name: '상태', kind: 'text' },
    {
      en: 'The current condition — poisoned, blessed, exhausted.',
      ko: '중독·축복·탈진 같은 현재 상태.',
      ja: '中毒・祝福・疲労などの現在の状態。'
    }
  ),
  tpl(
    't-ko-rank',
    { en: '랭크 — rank', ko: '랭크 (등급)', ja: 'ランク (ランク)' },
    'ko',
    { name: '랭크', kind: 'rank', grades: GRADES },
    {
      en: 'Where they sit on a grade ladder — F, E, D… SSS.',
      ko: '등급 사다리에서의 현재 위치 — F, E, D… SSS.',
      ja: '等級の中での現在位置 — F、E、D…SSS。'
    }
  ),
  tpl(
    't-ko-prog',
    { en: '진척도 — gauge', ko: '진척도 (게이지)', ja: '進捗度 (ゲージ)' },
    'ko',
    { name: '진척도', kind: 'gauge' },
    {
      en: 'Progress to the next step — `0% (0/4 에센스)`.',
      ko: '다음 단계까지의 진행률 — `0% (0/4 에센스)`.',
      ja: '次の段階までの進捗 — `0% (0/4)`。'
    }
  ),
  tpl(
    't-ko-skills',
    { en: '스킬 — list', ko: '스킬 (목록)', ja: 'スキル (リスト)' },
    'ko',
    { name: '스킬', kind: 'list' },
    {
      en: 'Skills, as a list.',
      ko: '보유 스킬을 목록으로 적습니다.',
      ja: '保有スキルをリストで書きます。'
    }
  ),

  // Japanese.
  tpl(
    't-ja-hp',
    { en: 'HP — resource', ko: 'HP (자원)', ja: 'HP (リソース)' },
    'ja',
    { name: 'HP', kind: 'resource' },
    {
      en: 'HP as current/max, なろう style.',
      ko: '현재/최대로 적는 HP. なろう식.',
      ja: '現在/最大で書くHP。'
    }
  ),
  tpl(
    't-ja-str',
    { en: '腕力 — stat', ko: '腕力 (능력치)', ja: '腕力 (能力値)' },
    'ja',
    { name: '腕力', kind: 'stat' },
    {
      en: 'Arm strength — the classic Japanese stat name.',
      ko: '팔의 힘. 일본식 정통 능력치 이름.',
      ja: '腕の力。王道の能力値名。'
    }
  ),
  tpl(
    't-ja-skill',
    { en: 'スキル — list', ko: 'スキル (목록)', ja: 'スキル (リスト)' },
    'ja',
    { name: 'スキル', kind: 'list' },
    {
      en: 'Skills, joined with 、.',
      ko: '보유 스킬. 「、」로 구분해 나열합니다.',
      ja: '保有スキル。「、」で区切って並べます。'
    }
  ),
  tpl(
    't-ja-bless',
    { en: '加護 — list', ko: '加護 (목록)', ja: '加護 (リスト)' },
    'ja',
    { name: '加護', kind: 'list' },
    {
      en: 'Divine blessings, as a list.',
      ko: '신에게 받은 가호 목록.',
      ja: '神々から受けた加護の一覧。'
    }
  ),

  // LitRPG.
  tpl(
    't-en-str',
    { en: 'STR — stat', ko: 'STR (능력치)', ja: 'STR (能力値)' },
    'en',
    { name: 'STR', kind: 'stat' },
    {
      en: 'Strength — the classic three-letter stat.',
      ko: '고전 3글자 능력치 표기.',
      ja: '古典的な3文字の能力値。'
    }
  ),
  tpl(
    't-en-xp',
    { en: 'Experience — gauge', ko: 'Experience (게이지)', ja: 'Experience (ゲージ)' },
    'en',
    { name: 'Experience', kind: 'gauge', unit: 'XP' },
    {
      en: 'Progress to the next level, measured in XP.',
      ko: '다음 레벨까지의 진행률 (XP 단위).',
      ja: '次のレベルまでの進捗 (XP単位)。'
    }
  ),
  tpl(
    't-en-hp',
    { en: 'Health — resource', ko: 'Health (자원)', ja: 'Health (リソース)' },
    'en',
    { name: 'Health', kind: 'resource' },
    {
      en: 'Hit points as current/max with regen.',
      ko: '현재/최대와 재생으로 적는 HP.',
      ja: '現在/最大と再生で書くHP。'
    }
  ),
  tpl(
    't-en-skills',
    { en: 'Skills — list', ko: 'Skills (목록)', ja: 'Skills (リスト)' },
    'en',
    { name: 'Skills', kind: 'list' },
    {
      en: 'Skill names, comma-joined.',
      ko: '스킬 이름을 콤마로 나열합니다.',
      ja: 'スキル名をカンマで並べます。'
    }
  )
];

// ── system messages ─────────────────────────────────────────────────────────

/**
 * The other block a serial prints — `레벨 업!`, `능력치 포인트 (1)`.
 *
 * Not a status window: no character, no attributes, just lines. It gets its own
 * tiny preset set because the three traditions punctuate it differently, and
 * because writers reach for it far more often than the full sheet.
 */
export interface SystemPreset {
  id: string;
  name: LocalizedText;
  family: 'ko' | 'ja' | 'en';
  template: string;
}

export const SYSTEM_PRESETS: SystemPreset[] = [
  {
    id: 'sys-ko',
    name: { en: 'Korean', ko: '한국식', ja: '韓国式' },
    family: 'ko',
    template: ['=====', '{{#lines}}{{.}}', '{{/lines}}====='].join('\n')
  },
  {
    id: 'sys-ja',
    name: { en: 'Japanese', ko: '일본식', ja: '日本式' },
    family: 'ja',
    template: ['{{#lines}}【{{.}}】', '{{/lines}}'].join('\n')
  },
  {
    id: 'sys-en',
    name: { en: 'LitRPG', ko: '미국식', ja: '米国式' },
    family: 'en',
    template: ['{{#lines}}[{{.}}]', '{{/lines}}'].join('\n')
  }
];

export const DEFAULT_SYSTEM_PRESET_ID = 'sys-ko';

export function systemPresetById(id: string): SystemPreset {
  return SYSTEM_PRESETS.find((preset) => preset.id === id) ?? (SYSTEM_PRESETS[0] as SystemPreset);
}
