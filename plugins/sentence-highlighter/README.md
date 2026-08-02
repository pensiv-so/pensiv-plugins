# Sentence Highlighter

Reference example for **`app.editor.decorate()`** and **`registerSlashItem()`** —
marks sentences longer than a configured word count.

## Use it

```bash
# from the monorepo root
npm install
npm run build -w @pensiv-plugins/sentence-highlighter
```

Then run `Sentence Highlighter: Toggle` from the command palette, or type
`/highlight long` in the editor.

## What it shows

- `editor.decorate(ranges)` — read-only highlights over document ranges.
- `registerSlashItem` — a row in the editor's `/` menu.
- `editor.on('update')` — keeping decorations pinned while the user types.
- `addSettingTab` with `slider` + `toggle` fields.
- `this.register(...)` — teardown that runs on disable, so highlights never
  outlive the plugin.

## Two things the code is careful about

**Decorations are plain numbers.** You pass `{ from, to }` and the *host* builds
the ProseMirror `DecorationSet`. Never build one yourself: a set constructed by a
plugin's own copy of prosemirror fails the host's `instanceof` check, poisons the
decoration group, and freezes the editor for the rest of the session. The API
takes numbers precisely so this cannot happen.

**Positions are static.** They are clamped to the document but not mapped through
later edits, so they drift as the user types. That is why `decorate()` returns a
disposer and why the "update while typing" option re-runs the whole pass on
`editor.on('update')` — drop the old set, compute fresh ranges, decorate again.

## Permissions

`editor.read` — decorations are read-only, so no `editor.write` is needed.
