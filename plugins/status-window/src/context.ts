/**
 * Building the template's view of a character — the bridge between typed values
 * and the mustache layout.
 *
 * ## Alignment happens here, not in the template
 *
 * Real Korean sheets line their colons up:
 *
 * ```
 * 근력   : 415(+566)   체력   : 201(+420)
 * 생명력 : 360(+454)   민첩   :  62(+515)
 * ```
 *
 * A template can't do that — it sees one row at a time and has no idea how wide
 * `생명력` is. So `{{name}}` arrives **already padded** to the widest name in its
 * scope (and `{{value}}` right-aligned when the preset asks), and the template
 * stays the two-token line a writer can actually edit. `{{rawName}}` /
 * `{{rawValue}}` are there for layouts that don't want it.
 *
 * Scope matters: names are padded within the block they render in — the flat
 * list, or one group, or one column of a two-column row. Padding every name to
 * the sheet's global maximum would push a two-word group heading's rows halfway
 * across the line.
 */
import {
  formatArrow,
  formatBar,
  formatDelta,
  formatValue,
  gaugePercent,
  rawValue,
  type FormatOptions
} from './format';
import type { AttributeDef, AttributeValue, CharacterSchema, ValueMap } from './model';
import { isEmptyValue } from './model';
import type { TemplateContext, TemplateValue } from './template';
import { maxWidth, padEnd, padStart, stringWidth } from './width';

/** Everything the renderer needs that isn't the character's numbers. */
export interface RenderInput {
  schema: CharacterSchema;
  /** The character's state in this episode (already folded from deltas). */
  values: ValueMap;
  /** State at the end of the previous episode, for arrows and deltas. */
  previous?: ValueMap;
  characterName: string;
  episodeTitle: string;
  /** 1-based position among sibling episodes. */
  episodeNumber?: number;
  /** `YYYY-MM-DD`, passed in because scripts can't read the clock deterministically. */
  date?: string;
  format: FormatOptions;
  /** Drop rows whose value is blank. Zero is never blank — see `isEmptyValue`. */
  omitEmpty: boolean;
  /** Pad names so colons line up. */
  align: boolean;
  /** Right-align values too — the `근력 : 415` / `민첩 :  62` look. */
  alignValues: boolean;
  /** Cells per row. 2 is the Korean default; Japanese and LitRPG use 1. */
  columns: 1 | 2;
  /** Character used for padding. Japanese sheets align with U+3000 IDEOGRAPHIC SPACE. */
  padChar: string;
}

/** One row, as the template sees it. */
interface AttributeContext extends TemplateContext {
  id: string;
  name: string;
  rawName: string;
  value: string;
  rawValue: string;
  kind: string;
}

/** Everything about one attribute, before any padding is applied. */
interface Cell {
  def: AttributeDef;
  value: AttributeValue;
  name: string;
  formatted: string;
  fields: TemplateContext;
}

function buildCell(def: AttributeDef, value: AttributeValue, input: RenderInput): Cell {
  const { format } = input;
  const formatted = formatValue(value, format);
  const previous = input.previous?.[def.id];

  const fields: TemplateContext = {
    kind: value.kind,
    raw: rawValue(value, format),
    unit: def.unit ?? '',
    prev: previous ? formatValue(previous, format) : '',
    delta: formatDelta(previous, value, format),
    arrow: formatArrow(previous, value, format)
  };

  switch (value.kind) {
    case 'stat':
      fields.base = format.thousands ? value.base.toLocaleString('en-US') : String(value.base);
      fields.bonus = value.bonus ?? 0;
      fields.grade = value.grade ?? '';
      fields.note = value.note ?? '';
      break;
    case 'resource':
      fields.cur = value.cur;
      fields.max = value.max;
      fields.regen = value.regen ?? 0;
      fields.percent = value.max > 0 ? Math.floor((value.cur / value.max) * 100) : 0;
      fields.bar = formatBar(fields.percent as number, format);
      break;
    case 'gauge': {
      const percent = gaugePercent(value);
      fields.cur = value.cur;
      fields.max = value.max;
      fields.percent = percent;
      fields.bar = formatBar(percent, format);
      break;
    }
    case 'rank':
      fields.grade = value.grade;
      fields.next = value.next ?? '';
      break;
    case 'list':
      fields.items = value.items.filter((item) => item.trim() !== '') as TemplateValue;
      break;
    case 'number':
      fields.n = value.n;
      break;
    case 'text':
      fields.text = value.text;
      break;
  }

  return { def, value, name: def.name, formatted, fields };
}

/** Kinds whose value is a magnitude, and so reads right-aligned in a column. */
const NUMERIC_KINDS = new Set(['number', 'stat', 'resource', 'gauge']);

/**
 * Turn cells into template rows, padding names (and optionally values) to the
 * widest in this scope.
 *
 * Values right-align only when **every** value in the column is a magnitude —
 * 검신's stat block, where ` 62(+515)` under `415(+566)` reads like a ledger.
 * The moment one row is text the whole column goes left: `위드` / `   1` /
 * `없음` / ` 100` alternating edges looks like a bug, and column two lines up
 * either way.
 */
function toContexts(cells: readonly Cell[], input: RenderInput): AttributeContext[] {
  const nameWidth = input.align ? maxWidth(cells.map((cell) => cell.name)) : 0;
  const valueWidth = input.alignValues ? maxWidth(cells.map((cell) => cell.formatted)) : 0;
  const rightAlign = cells.length > 0 && cells.every((cell) => NUMERIC_KINDS.has(cell.value.kind));

  return cells.map((cell) => {
    return {
      ...cell.fields,
      id: cell.def.id,
      rawName: cell.name,
      rawValue: cell.formatted,
      name: nameWidth > 0 ? padEnd(cell.name, nameWidth, input.padChar) : cell.name,
      // The spaces a template needs when it puts its own punctuation straight
      // after the name — `{{rawName}}:{{pad}} {{value}}` gives LitRPG's
      // `Name:       Silas`, where the colon hugs the label and the padding
      // follows it. `{{name}}` pads before the punctuation instead.
      // `padEnd('', n)` rather than `repeat(n)`: the pad character may itself be
      // two columns wide (U+3000), so the count is not the column deficit.
      pad: nameWidth > 0 ? padEnd('', nameWidth - stringWidth(cell.name), input.padChar) : '',
      value:
        valueWidth > 0
          ? rightAlign
            ? padStart(cell.formatted, valueWidth, input.padChar)
            : padEnd(cell.formatted, valueWidth, input.padChar)
          : cell.formatted,
      kind: cell.value.kind
    };
  });
}

/**
 * Mark position within a row.
 *
 * A separator that belongs *between* cells (the hunter sheet's `|`) can only be
 * emitted correctly if the template can ask "is this the last one" — otherwise
 * every line ends in a dangling pipe. `{{^last}} | {{/last}}` is the idiom.
 */
function withPosition(cells: AttributeContext[]): TemplateValue {
  return cells.map((cell, index) => ({
    ...cell,
    first: index === 0,
    last: index === cells.length - 1
  })) as TemplateValue;
}

/** Chunk cells into rows of `columns`, aligning each column independently. */
function toRows(cells: readonly Cell[], input: RenderInput): TemplateContext[] {
  if (input.columns === 1) {
    return toContexts(cells, input).map((cell) => ({ cells: withPosition([cell]) }));
  }

  const columnCount = input.columns;
  // Per-column widths: column 0 holds cells 0, 2, 4… and its names must line up
  // with each other, not with column 1's.
  const perColumn: Cell[][] = Array.from({ length: columnCount }, () => []);
  cells.forEach((cell, index) => {
    perColumn[index % columnCount]?.push(cell);
  });
  const contexts = perColumn.map((column) => toContexts(column, input));

  const rows: TemplateContext[] = [];
  for (let i = 0; i * columnCount < cells.length; i += 1) {
    const row: AttributeContext[] = [];
    for (let column = 0; column < columnCount; column += 1) {
      const cell = contexts[column]?.[i];
      if (cell) row.push(cell);
    }
    rows.push({ cells: withPosition(row) });
  }
  return rows;
}

/** Assemble the whole context a preset's template renders against. */
export function buildContext(input: RenderInput): TemplateContext {
  const { schema, values, omitEmpty } = input;

  const visible = schema.attrs.filter((def) => {
    if (def.hidden) return false;
    const value = values[def.id];
    if (value === undefined) return false;
    return !(omitEmpty && isEmptyValue(value));
  });

  const cells = visible.map((def) => buildCell(def, values[def.id] as AttributeValue, input));

  const ungrouped = cells.filter((cell) => !cell.def.groupId);
  const groups = [...schema.groups]
    .sort((a, b) => a.order - b.order)
    .map((group) => {
      const members = cells.filter((cell) => cell.def.groupId === group.id);
      return { group, members };
    })
    // A group with nothing in it this episode shouldn't print its heading.
    .filter(({ members }) => members.length > 0);

  // `attributes` is the ungrouped block. Templates that ignore groups entirely
  // still want every row, so a sheet with no groups puts everything here.
  const flat = groups.length > 0 ? ungrouped : cells;

  // Every attribute by id, for templates that lay out specific fields rather
  // than iterate. The Japanese Type 1 header packs three named fields onto one
  // line (`名前：… 種族：… Ｌv１`) — no iteration expresses that, so the escape
  // hatch is to address them directly: `{{by.race.value}}`. Guard a field that
  // may be absent with `{{#by.race}}種族：{{by.race.value}}<U+3000>{{/by.race}}`.
  const by: TemplateContext = {};
  for (const cell of toContexts(cells, { ...input, align: false, alignValues: false })) {
    by[cell.id as string] = cell;
  }

  const changed = cells.filter((cell) => {
    const previous = input.previous?.[cell.def.id];
    return previous !== undefined && formatValue(previous, input.format) !== cell.formatted;
  });

  return {
    characterName: input.characterName,
    episodeTitle: input.episodeTitle,
    episodeNumber: input.episodeNumber ?? '',
    date: input.date ?? '',

    attributes: toContexts(flat, input) as TemplateValue,
    rows: toRows(flat, input) as TemplateValue,
    // Every field on one line, the Japanese Type 1 layout. No padding: the line
    // is a run, not a column.
    inline: toContexts(flat, { ...input, align: false, alignValues: false }) as TemplateValue,

    groups: groups.map(({ group, members }) => ({
      groupName: group.name,
      attributes: toContexts(members, input) as TemplateValue,
      rows: toRows(members, input) as TemplateValue
    })) as TemplateValue,

    changed: toContexts(changed, input) as TemplateValue,
    hasChanges: changed.length > 0,
    by
  };
}

/**
 * Tidy the rendered block.
 *
 * Two-column templates end each line with the separator that follows the last
 * cell (`{{#cells}}… {{/cells}}`), so trailing spaces are structural, not sloppy
 * authoring — they have to come off here rather than out of the template. Runs
 * of blank lines are also collapsed: an empty group or an omitted row otherwise
 * leaves a hole in the middle of the block.
 */
export function tidy(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t\u3000]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}

/** Convenience: how wide the widest rendered line is. Used by the ASCII frames. */
export function blockWidth(text: string): number {
  return maxWidth(text.split('\n').map((line) => line));
}

export { stringWidth };
