/**
 * A mustache subset — enough to lay out a status window, and nothing else.
 *
 * ## What is supported
 *
 * | Syntax | Meaning |
 * | --- | --- |
 * | `{{name}}` / `{{{name}}}` | interpolate (identical — the output is plain text, so there is nothing to escape) |
 * | `{{a.b}}` | dotted path |
 * | `{{.}}` | the current item, inside a section over a list of strings |
 * | `{{#section}}…{{/section}}` | array → repeat per item; truthy → once; falsy/empty → skip |
 * | `{{^section}}…{{/section}}` | inverted: render only when falsy/empty |
 *
 * No partials, no lambdas, no custom delimiters. A template is a layout, and
 * every case in a real serial is covered by the table above.
 *
 * ## Standalone lines are removed
 *
 * This is not a nicety — it is the difference between usable output and a block
 * full of blank lines. Given
 *
 * ```
 * =====
 * {{#attributes}}
 * {{name}} : {{value}}
 * {{/attributes}}
 * =====
 * ```
 *
 * a naive renderer emits an empty line for each of the four section-tag lines.
 * Per the mustache spec, a line whose only non-whitespace content is a single
 * section tag is deleted entirely, newline included — so the block above prints
 * exactly the five lines the writer sees. Interpolation tags are never
 * standalone; `{{name}}` alone on a line is content.
 *
 * ## Falsiness is JavaScript's
 *
 * `{{#bonus}}` skips when `bonus` is `0`, `''`, `undefined` or an empty array.
 * That is deliberate and is what makes `{{#delta}} ({{delta}}){{/delta}}` print
 * the change only on episodes where something changed. Values that must render
 * at zero (`자유 스텟 : 0`) are interpolated, not sectioned.
 */

type TokenType = 'text' | 'name' | 'open' | 'inverted' | 'close';

interface Token {
  type: TokenType;
  value: string;
  /** Offset in the source template. Only tags carry it; text tokens don't need it. */
  start?: number;
  end?: number;
}

interface TextNode {
  type: 'text';
  value: string;
}
interface NameNode {
  type: 'name';
  value: string;
}
interface SectionNode {
  type: 'section';
  value: string;
  inverted: boolean;
  children: Node[];
}
type Node = TextNode | NameNode | SectionNode;

/** Anything a template can be handed. */
export type TemplateValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TemplateContext
  | TemplateValue[];
export interface TemplateContext {
  [key: string]: TemplateValue;
}

// Triple-brace first, so `{{{x}}}` isn't mis-read as `{{` + `{x`.
const TAG = /\{\{\{\s*([\w.]+)\s*\}\}\}|\{\{\s*([#^/&]?)\s*([\w.]+)\s*\}\}/g;

function tokenize(template: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;
  TAG.lastIndex = 0;

  for (let match = TAG.exec(template); match !== null; match = TAG.exec(template)) {
    if (match.index > cursor) {
      tokens.push({ type: 'text', value: template.slice(cursor, match.index) });
    }
    const [, triple, sigil, name] = match;
    const start = match.index;
    const end = start + match[0].length;
    if (triple !== undefined) {
      tokens.push({ type: 'name', value: triple, start, end });
    } else {
      const key = name ?? '';
      switch (sigil) {
        case '#':
          tokens.push({ type: 'open', value: key, start, end });
          break;
        case '^':
          tokens.push({ type: 'inverted', value: key, start, end });
          break;
        case '/':
          tokens.push({ type: 'close', value: key, start, end });
          break;
        default:
          tokens.push({ type: 'name', value: key, start, end });
      }
    }
    cursor = end;
  }

  if (cursor < template.length) {
    tokens.push({ type: 'text', value: template.slice(cursor) });
  }
  return tokens;
}

const isSectionTag = (token: Token | undefined): boolean =>
  token !== undefined &&
  (token.type === 'open' || token.type === 'inverted' || token.type === 'close');

/**
 * Delete the whitespace and newline around section tags that sit alone on their
 * line. Mutates the text tokens either side in place.
 *
 * ## Why this reads the source template rather than the tokens
 *
 * The obvious implementation — "is the previous text token whitespace ending in
 * a newline?" — is wrong twice over:
 *
 *  - a text token that happens to *start* mid-line still matches `^\s*$`, so
 *    `{{#xs}}{{.}} {{/xs}}` loses the space it was told to print;
 *  - two standalone tags in a row share one text token, and once the first tag
 *    has eaten it the second no longer looks standalone.
 *
 * Both disappear if standalone-ness is decided from the **original template
 * offsets**, before anything is mutated: a tag is standalone when the text from
 * its line start up to it, and from it to the line end, is horizontal
 * whitespace. Decide first, then strip.
 */
function trimStandalone(template: string, tokens: Token[]): void {
  const standalone = new Set<number>();

  tokens.forEach((token, index) => {
    if (!isSectionTag(token) || token.start === undefined || token.end === undefined) return;

    const lineStart = template.lastIndexOf('\n', token.start - 1) + 1;
    if (!/^[ \t]*$/.test(template.slice(lineStart, token.start))) return;

    const newline = template.indexOf('\n', token.end);
    const lineEnd = newline === -1 ? template.length : newline;
    if (!/^[ \t]*$/.test(template.slice(token.end, lineEnd))) return;

    standalone.add(index);
  });

  for (const index of standalone) {
    const before = tokens[index - 1];
    const after = tokens[index + 1];
    // The indentation in front of the tag. Already gone when the previous
    // standalone tag consumed this token — the replace is then a no-op.
    if (before !== undefined && before.type === 'text') {
      before.value = before.value.replace(/[ \t]*$/, '');
    }
    // The tag's own line ending.
    if (after !== undefined && after.type === 'text') {
      after.value = after.value.replace(/^[ \t]*\n?/, '');
    }
  }
}

function parse(tokens: Token[]): Node[] {
  const root: Node[] = [];
  const stack: SectionNode[] = [];
  const current = (): Node[] => stack[stack.length - 1]?.children ?? root;

  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        if (token.value !== '') current().push({ type: 'text', value: token.value });
        break;
      case 'name':
        current().push({ type: 'name', value: token.value });
        break;
      case 'open':
      case 'inverted': {
        const section: SectionNode = {
          type: 'section',
          value: token.value,
          inverted: token.type === 'inverted',
          children: []
        };
        current().push(section);
        stack.push(section);
        break;
      }
      case 'close': {
        const open = stack.pop();
        if (open === undefined) {
          throw new Error(`status-window: unexpected {{/${token.value}}} — no section is open`);
        }
        if (open.value !== token.value) {
          throw new Error(
            `status-window: {{/${token.value}}} closes {{#${open.value}}} — tags must nest`
          );
        }
        break;
      }
    }
  }

  const unclosed = stack[stack.length - 1];
  if (unclosed !== undefined) {
    throw new Error(`status-window: {{#${unclosed.value}}} is never closed`);
  }
  return root;
}

/** Walk the context stack, innermost first, resolving a dotted path. */
function lookup(stack: TemplateValue[], path: string): TemplateValue {
  if (path === '.') return stack[stack.length - 1];

  const parts = path.split('.');
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    let value = stack[i];
    let found = true;
    for (const part of parts) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        found = false;
        break;
      }
      value = (value as TemplateContext)[part];
      if (value === undefined) {
        found = false;
        break;
      }
    }
    if (found) return value;
  }
  return undefined;
}

const isFalsy = (value: TemplateValue): boolean =>
  value === undefined ||
  value === null ||
  value === false ||
  value === '' ||
  value === 0 ||
  (Array.isArray(value) && value.length === 0);

function stringify(value: TemplateValue): string {
  if (value === undefined || value === null || value === false) return '';
  if (value === true) return 'true';
  if (Array.isArray(value)) return value.map(stringify).join('');
  if (typeof value === 'object') return '';
  return String(value);
}

function renderNodes(nodes: Node[], stack: TemplateValue[], out: string[]): void {
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        out.push(node.value);
        break;
      case 'name':
        out.push(stringify(lookup(stack, node.value)));
        break;
      case 'section': {
        const value = lookup(stack, node.value);
        const falsy = isFalsy(value);

        if (node.inverted) {
          if (falsy) renderNodes(node.children, stack, out);
          break;
        }
        if (falsy) break;

        if (Array.isArray(value)) {
          for (const item of value) {
            stack.push(item);
            renderNodes(node.children, stack, out);
            stack.pop();
          }
        } else if (typeof value === 'object') {
          stack.push(value);
          renderNodes(node.children, stack, out);
          stack.pop();
        } else {
          // A truthy scalar renders its body once, with the scalar reachable as
          // `{{.}}` — `{{#grade}}[{{.}}]{{/grade}}`.
          stack.push(value);
          renderNodes(node.children, stack, out);
          stack.pop();
        }
        break;
      }
    }
  }
}

/** Parsed templates, keyed by source. Presets re-render on every keystroke. */
const cache = new Map<string, Node[]>();

/** Parse (and cache) a template. Throws on unbalanced tags. */
export function compile(template: string): Node[] {
  const cached = cache.get(template);
  if (cached) return cached;

  const tokens = tokenize(template);
  trimStandalone(template, tokens);
  const nodes = parse(tokens);

  // Unbounded growth isn't a concern — templates come from six presets plus
  // whatever the writer is editing — but a runaway custom-template loop
  // shouldn't leak either.
  if (cache.size > 64) cache.clear();
  cache.set(template, nodes);
  return nodes;
}

/** Render `template` against `context`. */
export function render(template: string, context: TemplateContext): string {
  const out: string[] = [];
  renderNodes(compile(template), [context], out);
  return out.join('');
}

/**
 * Render, returning the error message instead of throwing.
 *
 * The template editor calls this on every keystroke, and half-typed input is
 * unbalanced by definition — a thrown error there would blank the preview and
 * (through the host's guard) disable the pane after three of them.
 */
export function tryRender(
  template: string,
  context: TemplateContext
): { text: string; error?: string } {
  try {
    return { text: render(template, context) };
  } catch (error) {
    return { text: '', error: error instanceof Error ? error.message : String(error) };
  }
}
