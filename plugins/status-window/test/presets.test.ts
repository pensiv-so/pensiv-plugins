/**
 * Golden output, checked against real serials.
 *
 * These are the tests that decide whether the plugin is worth shipping. Every
 * expectation below is a block from a published work (or, for Japanese, from the
 * craft guide that codified the form), transcribed in
 * `docs/status-window-formats.md`. If the engine can reproduce these from typed
 * values, it can produce a status window a reader wouldn't flag as generated.
 */
import { describe, expect, it } from 'vitest';
import { renderStatusBlock, renderSystemBlock, type BlockInput } from '../src/render';
import { presetById, systemPresetById } from '../src/presets';
import type { AttributeValue, CharacterSchema, ValueMap } from '../src/model';

/** Build a schema/value pair from a preset's own fields plus a value map. */
function sheet(presetId: string, values: ValueMap): { schema: CharacterSchema; values: ValueMap } {
  const preset = presetById(presetId);
  return {
    schema: { groups: preset.groups, attrs: preset.fields },
    values
  };
}

function base(over: Partial<BlockInput> = {}): Omit<BlockInput, 'schema' | 'values'> {
  return {
    characterName: '',
    episodeTitle: '1화',
    omitEmpty: true,
    ...over
  };
}

const text = (t: string): AttributeValue => ({ kind: 'text', text: t });
const num = (n: number): AttributeValue => ({ kind: 'number', n });
const stat = (b: number, rest: Partial<Extract<AttributeValue, { kind: 'stat' }>> = {}): AttributeValue => ({
  kind: 'stat',
  base: b,
  ...rest
});

// ─────────────────────────────────────────────────────────────────────────────

describe('한국식 · 헌터물 — 나 혼자만 레벨업', () => {
  it('reproduces 성진우 at level 1', () => {
    const { schema, values } = sheet('ko-hunter', {
      name: text('성진우'),
      level: num(1),
      job: text('없음'),
      fatigue: num(0),
      hp: num(100),
      mp: num(10),
      str: stat(10),
      vit: stat(10),
      agi: stat(10),
      int: stat(10),
      sen: stat(10),
      ap: num(0)
    });

    const { text: out } = renderStatusBlock(presetById('ko-hunter'), {
      ...base({ characterName: '성진우' }),
      schema,
      values
    });

    expect(out).toBe(
      [
        '=====',
        '이름: 성진우 | 레벨: 1',
        '직업: 없음 | 피로도: 0',
        'HP: 100 | MP: 10',
        '근력: 10 | 체력: 10',
        '민첩: 10 | 지능: 10',
        '감각: 10 | AP: 0',
        '====='
      ].join('\n')
    );
  });

  it('never leaves a dangling pipe on an odd final row', () => {
    const { schema } = sheet('ko-hunter', {});
    const { text: out } = renderStatusBlock(presetById('ko-hunter'), {
      ...base(),
      schema,
      values: { name: text('A'), level: num(3), job: text('헌터') }
    });
    expect(out).toBe(['=====', '이름: A | 레벨: 3', '직업: 헌터', '====='].join('\n'));
  });
});

describe('한국식 · 게임판타지 — 달빛조각사', () => {
  it('reproduces 위드 at level 1, colons aligned in two columns', () => {
    const { schema, values } = sheet('ko-classic', {
      name: text('위드'),
      alignment: text('무'),
      level: num(1),
      job: text('무직'),
      title: text('없음'),
      fame: num(0),
      hp: num(100),
      mp: num(0),
      str: stat(11),
      agi: stat(10),
      vit: stat(10),
      wis: stat(10),
      lead: stat(5),
      luck: stat(5),
      atk: stat(3),
      def: stat(0),
      mres: text('무')
    });

    const { text: out } = renderStatusBlock(presetById('ko-classic'), {
      ...base({ characterName: '위드' }),
      schema,
      values
    });

    // Names pad to the widest in their own column (`캐릭터 이름` = 11 columns
    // left, `방어력` = 6 right); values pad so column two starts on a straight
    // edge. Both columns mix text and numbers, so both stay left-aligned.
    expect(out).toBe(
      [
        '=====',
        '캐릭터 이름 : 위드   성향   : 무',
        '레벨        : 1      직업   : 무직',
        '칭호        : 없음   명성   : 0',
        '생명력      : 100    마나   : 0',
        '힘          : 11     민첩   : 10',
        '체력        : 10     지혜   : 10',
        '통솔력      : 5      행운   : 5',
        '공격력      : 3      방어력 : 0',
        '마법 저항   : 무',
        '====='
      ].join('\n')
    );
  });
});

describe('한국식 · 성장물 — 회귀도 13번이면 지랄 맞다 (주공혁)', () => {
  it('reproduces the growth arrows with grade suffixes', () => {
    const preset = presetById('ko-growth');
    const schema: CharacterSchema = {
      groups: [],
      attrs: [
        { id: 'str', name: '근력', kind: 'stat' },
        { id: 'end', name: '내구', kind: 'stat' },
        { id: 'agi', name: '민첩', kind: 'stat' },
        { id: 'tec', name: '기술', kind: 'stat' },
        { id: 'mnd', name: '정신', kind: 'stat' },
        { id: 'wil', name: '의지', kind: 'stat' }
      ]
    };

    const previous: ValueMap = {
      str: stat(14, { grade: 'F' }),
      end: stat(21, { grade: 'F' }),
      agi: stat(17, { grade: 'F' }),
      tec: stat(38, { grade: 'F' }),
      mnd: stat(12, { grade: 'F' }),
      wil: stat(34, { grade: 'F' })
    };
    const values: ValueMap = {
      str: stat(16, { bonus: 2, grade: 'F' }),
      end: stat(23, { bonus: 2, grade: 'F' }),
      agi: stat(18, { bonus: 1, grade: 'F' }),
      tec: stat(298, { bonus: 260, note: '밸런스 한계치', grade: 'D' }),
      mnd: stat(149, { bonus: 187, note: '−50', grade: 'E' }),
      wil: stat(300, { bonus: 266, note: '밸런스 한계치', grade: 'D' })
    };

    // One column: the arrows are long, and the source prints them one per line.
    const { text: out } = renderStatusBlock(
      { ...preset, columns: 1, alignValues: false },
      { ...base({ characterName: '주공혁' }), schema, values, previous }
    );

    expect(out).toBe(
      [
        '=====',
        '근력 : 14 [F] → 16(+2)[F]',
        '내구 : 21 [F] → 23(+2)[F]',
        '민첩 : 17 [F] → 18(+1)[F]',
        '기술 : 38 [F] → 298(+260 밸런스 한계치)[D]',
        '정신 : 12 [F] → 149(+187 −50)[E]',
        '의지 : 34 [F] → 300(+266 밸런스 한계치)[D]',
        '====='
      ].join('\n')
    );
  });

  it('prints the value alone on an episode where nothing moved', () => {
    const preset = presetById('ko-growth');
    const schema: CharacterSchema = { groups: [], attrs: [{ id: 'str', name: '근력', kind: 'stat' }] };
    const held = stat(16, { bonus: 2, grade: 'F' });

    const { text: out } = renderStatusBlock(
      { ...preset, columns: 1, alignValues: false },
      { ...base(), schema, values: { str: held }, previous: { str: held } }
    );
    expect(out).toBe(['=====', '근력 : 16(+2)[F]', '====='].join('\n'));
  });
});

describe('한국식 · 검신 — base(+bonus) in two aligned columns', () => {
  it('right-aligns the values the way the source does', () => {
    const preset = presetById('ko-growth');
    const schema: CharacterSchema = {
      groups: [],
      attrs: [
        { id: 'str', name: '근력', kind: 'stat' },
        { id: 'vit', name: '체력', kind: 'stat' },
        { id: 'hp', name: '생명력', kind: 'stat' },
        { id: 'agi', name: '민첩', kind: 'stat' }
      ]
    };
    const values: ValueMap = {
      str: stat(415, { bonus: 566 }),
      vit: stat(201, { bonus: 420 }),
      hp: stat(360, { bonus: 454 }),
      agi: stat(62, { bonus: 515 })
    };

    // 검신 prints current values, not growth arrows — a different work from
    // 주공혁, so the preset's default `{{arrow}}` line is swapped for `{{value}}`.
    const template = [
      '=====',
      '{{#rows}}{{#cells}}{{name}} : {{value}}{{^last}}   {{/last}}{{/cells}}',
      '{{/rows}}====='
    ].join('\n');

    const { text: out } = renderStatusBlock(
      { ...preset, template },
      { ...base(), schema, values }
    );

    expect(out).toBe(
      [
        '=====',
        '근력   : 415(+566)   체력 : 201(+420)',
        '생명력 : 360(+454)   민첩 :  62(+515)',
        '====='
      ].join('\n')
    );
  });
});

describe('He Who Fights With Monsters — groups, gauge, rank, list', () => {
  it('reproduces the 제이슨 sheet', () => {
    const schema: CharacterSchema = {
      groups: [
        { id: 'g-abil', name: '능력치', order: 1 },
        { id: 'g-race', name: '종족 특성 (이계인)', order: 2 }
      ],
      attrs: [
        { id: 'name', name: '이름', kind: 'text' },
        { id: 'race', name: '종족', kind: 'text' },
        { id: 'rank', name: '현재 랭크', kind: 'rank', grades: ['노말', '아이언', '브론즈'] },
        { id: 'prog', name: '아이언 랭크까지의 진척도', kind: 'gauge' },
        { id: 'power', name: '파워', kind: 'text', groupId: 'g-abil' },
        { id: 'speed', name: '스피드', kind: 'text', groupId: 'g-abil' },
        { id: 'spirit', name: '스피릿', kind: 'text', groupId: 'g-abil' },
        { id: 'rec', name: '리커버리', kind: 'text', groupId: 'g-abil' },
        { id: 'traits', name: '특성', kind: 'list', groupId: 'g-race' }
      ]
    };
    const values: ValueMap = {
      name: text('제이슨'),
      race: text('이계인'),
      rank: { kind: 'rank', grade: '노말', next: '아이언' },
      prog: { kind: 'gauge', cur: 0, max: 4, unit: '에센스' },
      power: text('(에센스 없음): 일반'),
      speed: text('(에센스 없음): 일반'),
      spirit: text('(에센스 없음): 일반'),
      rec: text('(에센스 없음): 일반'),
      traits: {
        kind: 'list',
        items: ['인터페이스', '퀘스트 시스템', '인벤토리', '지도', '아스트랄 친화력']
      }
    };

    // The source's own layout: ungrouped block, then a heading per group with
    // bracketed names, and the racial traits as bare bracketed lines.
    const template = [
      '=====',
      '{{#attributes}}{{rawName}}: {{value}}',
      '{{/attributes}}{{#groups}}',
      '{{groupName}}',
      '{{#attributes}}{{#items}}[{{.}}]',
      '{{/items}}{{^items}}[{{rawName}}] {{value}}',
      '{{/items}}{{/attributes}}{{/groups}}'
    ].join('\n');

    const { text: out } = renderStatusBlock(
      { ...presetById('ko-classic'), columns: 1, align: false, template },
      { ...base({ characterName: '제이슨' }), schema, values }
    );

    expect(out).toBe(
      [
        '=====',
        '이름: 제이슨',
        '종족: 이계인',
        '현재 랭크: 노말',
        '아이언 랭크까지의 진척도: 0% (0/4 에센스)',
        '',
        '능력치',
        '[파워] (에센스 없음): 일반',
        '[스피드] (에센스 없음): 일반',
        '[스피릿] (에센스 없음): 일반',
        '[리커버리] (에센스 없음): 일반',
        '',
        '종족 특성 (이계인)',
        '[인터페이스]',
        '[퀘스트 시스템]',
        '[인벤토리]',
        '[지도]',
        '[아스트랄 친화력]'
      ].join('\n')
    );
  });
});

describe('일본식 · なろう Type 1', () => {
  /**
   * Type 1 packs named fields onto shared lines (`名前：… 種族：… Ｌv１`), which
   * no iteration expresses. `{{by.<id>}}` is the escape hatch, and this is what
   * it is for. Fullwidth colon and ideographic space throughout.
   */
  it('reproduces the packed header and stat rows via {{by}}', () => {
    const { schema, values } = sheet('ja-classic', {
      name: text('田中　太郎'),
      race: text('人間'),
      level: num(1),
      job: text('ヒキニート'),
      hp: { kind: 'resource', cur: 4545, max: 4545 },
      mp: { kind: 'resource', cur: 4545, max: 4545 },
      str: stat(4545),
      leg: stat(4545),
      vit: stat(4545),
      agi: stat(4545),
      dex: stat(4545),
      mnd: stat(4545),
      equip: { kind: 'list', items: ['〇〇〇', '〇〇〇'] },
      skill: { kind: 'list', items: ['〇〇〇', '〇〇〇'] }
    });

    const template = [
      '名前：{{by.name.value}}　種族：{{by.race.value}}　Ｌv{{by.level.value}}',
      '職業：{{by.job.value}}',
      'HP：{{by.hp.raw}}　MP：{{by.mp.raw}}',
      '腕力：{{by.str.value}}　脚力：{{by.leg.value}}　体力：{{by.vit.value}}',
      '敏捷：{{by.agi.value}}　器用：{{by.dex.value}}　精神：{{by.mnd.value}}',
      '装備：{{by.equip.value}}',
      'スキル：{{by.skill.value}}'
    ].join('\n');

    const { text: out } = renderStatusBlock(
      { ...presetById('ja-classic'), template },
      { ...base({ characterName: '田中　太郎' }), schema, values }
    );

    expect(out).toBe(
      [
        '名前：田中　太郎　種族：人間　Ｌv1',
        '職業：ヒキニート',
        'HP：4545　MP：4545',
        '腕力：4545　脚力：4545　体力：4545',
        '敏捷：4545　器用：4545　精神：4545',
        '装備：〇〇〇、〇〇〇',
        'スキル：〇〇〇、〇〇〇'
      ].join('\n')
    );
  });

  it('joins lists with the ideographic comma, not a Latin one', () => {
    const { schema } = sheet('ja-classic', {});
    const { text: out } = renderStatusBlock(presetById('ja-classic'), {
      ...base(),
      schema,
      values: { skill: { kind: 'list', items: ['火魔法', '鑑定'] } }
    });
    expect(out).toContain('スキル：火魔法、鑑定');
  });
});

describe('일본식 · なろう Type 2 (minimal)', () => {
  it('puts the name alone on the first line and pads with ideographic spaces', () => {
    const { schema, values } = sheet('ja-minimal', {
      job: text('ヒキニート'),
      equip: { kind: 'list', items: ['〇〇〇', '〇〇〇'] },
      skill: { kind: 'list', items: ['〇〇〇'] }
    });

    const { text: out } = renderStatusBlock(presetById('ja-minimal'), {
      ...base({ characterName: '田中　太郎' }),
      schema,
      values
    });

    expect(out).toBe(
      ['田中　太郎', '職業：ヒキニート', '装備：〇〇〇、〇〇〇', 'スキル：〇〇〇'].join('\n')
    );
  });
});

describe('미국식 · LitRPG', () => {
  it('groups thousands, draws the XP bar, and sections skills', () => {
    const { schema, values } = sheet('en-litrpg', {
      name: text('Silas'),
      class: text('Adventurer (C Rank)'),
      level: num(23),
      xp: { kind: 'gauge', cur: 1240, max: 2000, unit: 'XP' },
      str: stat(42),
      dex: stat(57),
      skills: { kind: 'list', items: ['Iron Grip', 'Sword Mastery'] },
      titles: { kind: 'list', items: ['Beast Slayer'] }
    });

    const { text: out } = renderStatusBlock(presetById('en-litrpg'), {
      ...base({ characterName: 'Silas' }),
      schema,
      values
    });

    expect(out).toBe(
      [
        '[ Status ]',
        'Name:       Silas',
        'Class:      Adventurer (C Rank)',
        'Level:      23',
        'Experience: 62% (1,240/2,000 XP)  [██████░░░░]',
        'STR:        42',
        'DEX:        57',
        '',
        '── Skills & Titles ──',
        'Skills: Iron Grip, Sword Mastery',
        'Titles: Beast Slayer'
      ].join('\n')
    );
  });
});

describe('system messages', () => {
  it('wraps Korean notifications in the ===== frame', () => {
    const { text: out } = renderSystemBlock(systemPresetById('sys-ko'), [
      '레벨 업!',
      '능력치 포인트 (1)',
      '특성 포인트 (1)',
      '트리 포인트 (1)'
    ]);
    expect(out).toBe(
      ['=====', '레벨 업!', '능력치 포인트 (1)', '특성 포인트 (1)', '트리 포인트 (1)', '====='].join(
        '\n'
      )
    );
  });

  it('brackets each line for LitRPG', () => {
    const { text: out } = renderSystemBlock(systemPresetById('sys-en'), [
      'You are now Level 14',
      'New Skill Acquired: Iron Grip (Passive)'
    ]);
    expect(out).toBe('[You are now Level 14]\n[New Skill Acquired: Iron Grip (Passive)]');
  });

  it('uses the lenticular brackets for Japanese', () => {
    const { text: out } = renderSystemBlock(systemPresetById('sys-ja'), ['レベルアップ！']);
    expect(out).toBe('【レベルアップ！】');
  });

  it('drops blank lines', () => {
    const { text: out } = renderSystemBlock(systemPresetById('sys-en'), ['a', '   ', 'b']);
    expect(out).toBe('[a]\n[b]');
  });
});

describe('omitEmpty', () => {
  it('drops blank text rows but keeps zeroes', () => {
    const { schema } = sheet('ko-hunter', {});
    const { text: out } = renderStatusBlock(presetById('ko-hunter'), {
      ...base({ omitEmpty: true }),
      schema,
      values: { name: text('A'), job: text('   '), ap: num(0) }
    });
    expect(out).toBe(['=====', '이름: A | AP: 0', '====='].join('\n'));
  });
});

describe('every preset renders without throwing on an empty sheet', () => {
  it.each(['ko-classic', 'ko-hunter', 'ko-growth', 'ja-classic', 'ja-minimal', 'en-litrpg'])(
    '%s',
    (id) => {
      const preset = presetById(id);
      const result = renderStatusBlock(preset, {
        ...base(),
        schema: { groups: preset.groups, attrs: preset.fields },
        values: {}
      });
      expect(result.error).toBeUndefined();
    }
  );
});
