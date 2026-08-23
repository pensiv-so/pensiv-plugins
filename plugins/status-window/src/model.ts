/**
 * What a status window is made of.
 *
 * ## Why attributes are typed
 *
 * A naive status window is a list of `{ name, value }` strings, and it makes the
 * writer type every convention by hand: `415(+566)`, `70/70 재생 0.80/분`,
 * `0% (0/4 에센스)`, `14 [F] → 16(+2)[F]`. Those are not free text — they are six
 * recurring shapes with their own arithmetic, and once they are typed the plugin
 * can format them per convention, diff them between episodes, and render the
 * same character as a Korean hunter sheet or a LitRPG stat block without the
 * writer retyping anything.
 *
 * The six kinds were derived from real serials rather than invented; see
 * `docs/status-window-formats.md` in the app repo for the sources.
 *
 * ## Schema and values are separate
 *
 * {@link AttributeDef} is the *shape* of a character's sheet — it belongs to the
 * character and rarely changes. {@link AttributeValue} is what that attribute
 * reads in one episode, and it is stored per episode as a delta. Keeping them
 * apart is what makes "what were her stats at chapter 31?" a fold rather than a
 * search, and it is the one thing every spreadsheet-based workflow fails at.
 */

/** The six shapes a stat takes in real serials. */
export type AttributeKind = 'text' | 'number' | 'stat' | 'resource' | 'gauge' | 'rank' | 'list';

/**
 * A named section of the sheet — `능력치`, `종족 특성 (이계인)`, `Skills`.
 *
 * Groups are flat (no nesting): every real example uses one level, and a second
 * level would buy nothing but indentation rules to get wrong.
 */
export interface AttributeGroup {
  id: string;
  name: string;
  /** Sort key among sibling groups. Ungrouped attributes render first. */
  order: number;
}

/** One row of a character's sheet — the shape, not the value. */
export interface AttributeDef {
  id: string;
  /** As the writer typed it: `근력`, `腕力`, `STR`. Never translated. */
  name: string;
  kind: AttributeKind;
  /** Group this row belongs to. Omit for the ungrouped block at the top. */
  groupId?: string;
  /** Trailing unit for `number` / `gauge` — `세`, `에센스`, `pts`. */
  unit?: string;
  /**
   * Rank ladder for `rank`, low to high — `['F','E','D','C','B','A','S']`,
   * `['노말','아이언','브론즈','실버']`. Used to offer the next rank and to
   * validate what the writer types; a value outside the ladder is still kept.
   */
  grades?: string[];
  /** Kept in the sheet but never rendered. For scratch values. */
  hidden?: boolean;
}

/**
 * What one attribute reads in one episode.
 *
 * The `kind` is repeated here rather than looked up from the def on purpose: a
 * value is stored per episode and read back long after the def may have changed
 * kind, and a stored `{ base, bonus }` must not be reinterpreted as a resource
 * because the writer edited the sheet later. Mismatches render as the value's
 * own kind and are surfaced in the editor.
 */
export type AttributeValue =
  /** `검신(신화)`, `'쇠뿔을 꺾는 자'`, `정상`. */
  | { kind: 'text'; text: string }
  /** `64`, `0`. */
  | { kind: 'number'; n: number }
  /**
   * The workhorse: a base value with optional equipment bonus, free-form note
   * and grade letter.
   *
   * `415(+566)` · `298(+260 밸런스 한계치)[D]` · `149(+187 −50)[E]` · `14 [F]`
   *
   * `note` is the text that trails the bonus inside the parens. It is free-form
   * because real serials put anything there — a cap name, a second modifier.
   */
  | { kind: 'stat'; base: number; bonus?: number; grade?: string; note?: string }
  /** `70/70 재생 0.80/분` — a pool that depletes, with optional regeneration. */
  | { kind: 'resource'; cur: number; max: number; regen?: number }
  /** `0% (0/4 에센스)` — progress toward something, shown as a percentage. */
  | { kind: 'gauge'; cur: number; max: number; unit?: string }
  /** `노말`, with the next rung on the ladder available to the template. */
  | { kind: 'rank'; grade: string; next?: string }
  /** `[인터페이스]` `[퀘스트 시스템]` — skills, titles, racial traits. */
  | { kind: 'list'; items: string[] };

/** The shape of one character's sheet. */
export interface CharacterSchema {
  groups: AttributeGroup[];
  attrs: AttributeDef[];
}

/** A character the plugin knows about. */
export interface Character {
  /**
   * A project sheet's file id when the character is a real entity in the
   * manuscript, or `local:<uuid>` for one that only exists in this plugin.
   * Writers who keep character sheets get them for free; writers who don't
   * shouldn't have to create five files before they can write a status window.
   */
  id: string;
  /** Display name. For sheet-backed characters the project title wins. */
  name: string;
  /** Set when `id` is a project file id. */
  fileId?: string;
  /** The sheet's icon — an icon name or a raw emoji, as the app stores it. */
  icon?: string;
  /** The sheet's category, which picks the file tree's default glyph. */
  sheetCategory?: string;
  /** The sheet's portrait thumbnail, shown in preference to the icon. */
  portraitUrl?: string;
}

/** `attrId` → what it reads. A whole sheet's worth, or one episode's changes. */
export type ValueMap = Record<string, AttributeValue>;

/** Prefix marking a character that lives only in plugin storage. */
export const LOCAL_PREFIX = 'local:';

export function isLocalCharacter(id: string): boolean {
  return id.startsWith(LOCAL_PREFIX);
}

/**
 * Ids are generated client-side and never reconciled with a server, so they only
 * have to be unique within one manuscript. `randomUUID` where it exists, a
 * random suffix elsewhere (older WebViews).
 */
export function newId(prefix = 'sw'): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

/** A blank value of the given kind, for a newly added row. */
export function emptyValue(kind: AttributeKind): AttributeValue {
  switch (kind) {
    case 'text':
      return { kind: 'text', text: '' };
    case 'number':
      return { kind: 'number', n: 0 };
    case 'stat':
      return { kind: 'stat', base: 0 };
    case 'resource':
      return { kind: 'resource', cur: 0, max: 0 };
    case 'gauge':
      return { kind: 'gauge', cur: 0, max: 0 };
    case 'rank':
      return { kind: 'rank', grade: '' };
    case 'list':
      return { kind: 'list', items: [] };
  }
}

/**
 * Whether a value carries nothing worth printing — what the "omit empty" option
 * tests. Zero is *not* empty: `자유 스텟 : 0` is a meaningful line in every
 * Korean status window, and dropping it would be wrong.
 */
export function isEmptyValue(value: AttributeValue): boolean {
  switch (value.kind) {
    case 'text':
      return value.text.trim() === '';
    case 'rank':
      return value.grade.trim() === '';
    case 'list':
      return value.items.filter((item) => item.trim() !== '').length === 0;
    case 'number':
    case 'stat':
    case 'resource':
    case 'gauge':
      return false;
  }
}

/** Structural equality — drives both the delta write and the diff. */
export function valuesEqual(a: AttributeValue | undefined, b: AttributeValue | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'text':
      return a.text === (b as typeof a).text;
    case 'number':
      return a.n === (b as typeof a).n;
    case 'stat': {
      const other = b as typeof a;
      return (
        a.base === other.base &&
        (a.bonus ?? 0) === (other.bonus ?? 0) &&
        (a.grade ?? '') === (other.grade ?? '') &&
        (a.note ?? '') === (other.note ?? '')
      );
    }
    case 'resource': {
      const other = b as typeof a;
      return a.cur === other.cur && a.max === other.max && (a.regen ?? 0) === (other.regen ?? 0);
    }
    case 'gauge': {
      const other = b as typeof a;
      return a.cur === other.cur && a.max === other.max && (a.unit ?? '') === (other.unit ?? '');
    }
    case 'rank': {
      const other = b as typeof a;
      return a.grade === other.grade && (a.next ?? '') === (other.next ?? '');
    }
    case 'list': {
      const other = b as typeof a;
      return (
        a.items.length === other.items.length && a.items.every((it, i) => it === other.items[i])
      );
    }
  }
}
