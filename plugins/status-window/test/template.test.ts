import { describe, expect, it } from 'vitest';
import { render, tryRender } from '../src/template';

describe('interpolation', () => {
  it('substitutes a name', () => {
    expect(render('Hello {{who}}', { who: 'world' })).toBe('Hello world');
  });

  it('treats triple braces the same — plain text has nothing to escape', () => {
    expect(render('{{{who}}}', { who: '<b>' })).toBe('<b>');
    expect(render('{{who}}', { who: '<b>' })).toBe('<b>');
  });

  it('renders a missing key as empty', () => {
    expect(render('[{{nope}}]', {})).toBe('[]');
  });

  it('renders zero, not empty', () => {
    expect(render('자유 스텟 : {{free}}', { free: 0 })).toBe('자유 스텟 : 0');
  });

  it('resolves a dotted path', () => {
    expect(render('{{a.b}}', { a: { b: 'deep' } })).toBe('deep');
  });

  it('tolerates whitespace inside the braces', () => {
    expect(render('{{  who  }}', { who: 'x' })).toBe('x');
  });
});

describe('sections', () => {
  it('repeats over an array', () => {
    expect(render('{{#xs}}[{{.}}]{{/xs}}', { xs: ['a', 'b'] })).toBe('[a][b]');
  });

  it('skips an empty array', () => {
    expect(render('a{{#xs}}X{{/xs}}b', { xs: [] })).toBe('ab');
  });

  it('renders once for a truthy scalar, exposing it as {{.}}', () => {
    expect(render('{{#g}}[{{.}}]{{/g}}', { g: 'D' })).toBe('[D]');
  });

  it('skips a falsy scalar — the {{#delta}} idiom', () => {
    expect(render('x{{#delta}} ({{delta}}){{/delta}}', { delta: '' })).toBe('x');
    expect(render('x{{#delta}} ({{delta}}){{/delta}}', { delta: '+2' })).toBe('x (+2)');
    expect(render('x{{#bonus}}!{{/bonus}}', { bonus: 0 })).toBe('x');
  });

  it('pushes an object onto the context stack', () => {
    expect(render('{{#a}}{{b}}{{/a}}', { a: { b: 'inner' } })).toBe('inner');
  });

  it('falls back to an outer scope from inside a section', () => {
    expect(render('{{#xs}}{{outer}}-{{.}} {{/xs}}', { outer: 'O', xs: ['1', '2'] })).toBe(
      'O-1 O-2 '
    );
  });

  it('nests', () => {
    const template = '{{#groups}}{{groupName}}:{{#attributes}}{{name}},{{/attributes}}{{/groups}}';
    const context = {
      groups: [
        { groupName: 'G1', attributes: [{ name: 'a' }, { name: 'b' }] },
        { groupName: 'G2', attributes: [{ name: 'c' }] }
      ]
    };
    expect(render(template, context)).toBe('G1:a,b,G2:c,');
  });
});

describe('inverted sections', () => {
  it('renders when the value is falsy or empty', () => {
    expect(render('{{^xs}}none{{/xs}}', { xs: [] })).toBe('none');
    expect(render('{{^xs}}none{{/xs}}', { xs: ['a'] })).toBe('');
    expect(render('{{^last}} | {{/last}}', { last: false })).toBe(' | ');
    expect(render('{{^last}} | {{/last}}', { last: true })).toBe('');
  });
});

describe('standalone lines', () => {
  /**
   * Without this the four section-tag lines each emit a blank line and the block
   * comes out double-spaced — the single most visible difference between a
   * usable renderer and a broken one.
   */
  it('deletes a line that holds only a section tag', () => {
    const template = ['=====', '{{#xs}}', '{{.}}', '{{/xs}}', '====='].join('\n');
    expect(render(template, { xs: ['a', 'b'] })).toBe('=====\na\nb\n=====');
  });

  it('handles the inline form the presets use', () => {
    const template = ['=====', '{{#xs}}{{.}}', '{{/xs}}====='].join('\n');
    expect(render(template, { xs: ['a', 'b'] })).toBe('=====\na\nb\n=====');
  });

  it('leaves a lone interpolation tag alone — that is content', () => {
    expect(render('a\n{{x}}\nb', { x: 'X' })).toBe('a\nX\nb');
  });

  it('does not strip a tag that shares its line with text', () => {
    expect(render('x {{#s}}y{{/s}} z', { s: true })).toBe('x y z');
  });

  it('strips indentation before a standalone tag', () => {
    const template = ['a', '  {{#s}}', 'b', '  {{/s}}', 'c'].join('\n');
    expect(render(template, { s: true })).toBe('a\nb\nc');
  });

  it('produces nothing at all for an empty section', () => {
    const template = ['{{#xs}}', 'x', '{{/xs}}'].join('\n');
    expect(render(template, { xs: [] })).toBe('');
  });
});

describe('errors', () => {
  it('reports an unclosed section', () => {
    expect(() => render('{{#a}}x', {})).toThrow(/never closed/);
  });

  it('reports a stray close', () => {
    expect(() => render('x{{/a}}', {})).toThrow(/no section is open/);
  });

  it('reports crossed tags', () => {
    expect(() => render('{{#a}}{{#b}}{{/a}}{{/b}}', {})).toThrow(/must nest/);
  });

  /**
   * The template editor renders on every keystroke, and half-typed input is
   * unbalanced by definition. Throwing there would blank the preview and, after
   * three throws, let the host guard disable the pane for the session.
   */
  it('tryRender returns the message instead of throwing', () => {
    const result = tryRender('{{#a}}x', {});
    expect(result.text).toBe('');
    expect(result.error).toMatch(/never closed/);
  });
});
