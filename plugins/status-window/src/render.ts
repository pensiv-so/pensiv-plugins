/**
 * One call from "a character in an episode" to "the text that goes in the page".
 *
 * Everything upstream is a part — {@link buildContext} shapes the data,
 * {@link tryRender} runs the layout, {@link tidy} cleans the seams. This is the
 * only function the UI, the slash command and the block refresher all agree on,
 * so a status window inserted from the pane and one refreshed in place cannot
 * drift apart.
 */
import { buildContext, tidy, type RenderInput } from './context';
import type { CharacterSchema, ValueMap } from './model';
import type { Preset, SystemPreset } from './presets';
import { tryRender, type TemplateContext, type TemplateValue } from './template';

/** What the caller knows; the preset supplies the rest. */
export interface BlockInput {
  schema: CharacterSchema;
  values: ValueMap;
  previous?: ValueMap;
  characterName: string;
  episodeTitle: string;
  episodeNumber?: number;
  date?: string;
  /** Drop blank rows. A per-writer preference, not a per-convention one. */
  omitEmpty: boolean;
  /** Overrides the preset's own template when the writer has edited it. */
  template?: string;
}

export interface RenderResult {
  text: string;
  /** Set when the template is unbalanced — shown in the editor, never thrown. */
  error?: string;
}

/** Fold a preset's convention together with the caller's data. */
function toRenderInput(preset: Preset, input: BlockInput): RenderInput {
  return {
    schema: input.schema,
    values: input.values,
    previous: input.previous,
    characterName: input.characterName,
    episodeTitle: input.episodeTitle,
    episodeNumber: input.episodeNumber,
    date: input.date,
    format: preset.format,
    omitEmpty: input.omitEmpty,
    align: preset.align,
    alignValues: preset.alignValues,
    columns: preset.columns,
    padChar: preset.padChar
  };
}

/** Render one character's status window. */
export function renderStatusBlock(preset: Preset, input: BlockInput): RenderResult {
  const context = buildContext(toRenderInput(preset, input));
  const { text, error } = tryRender(input.template ?? preset.template, context);
  return error === undefined ? { text: tidy(text) } : { text: '', error };
}

/** Render a system message — `레벨 업!` and friends. */
export function renderSystemBlock(
  preset: SystemPreset,
  lines: readonly string[],
  template?: string
): RenderResult {
  const context: TemplateContext = {
    lines: lines.filter((line) => line.trim() !== '') as TemplateValue
  };
  const { text, error } = tryRender(template ?? preset.template, context);
  return error === undefined ? { text: tidy(text) } : { text: '', error };
}
