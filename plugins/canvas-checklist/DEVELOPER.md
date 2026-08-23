# Canvas Checklist — developer notes

> Moved out of `README.md` so the marketplace listing stays purely
> user-facing. Everything below is for plugin authors reading the source.

## For plugin authors

Reference example for **`registerCanvasNode()`** — a plugin's own object on the
canvas, added from the canvas toolbar next to the built-in note, file and image
cards.

```bash
# from the monorepo root
npm install
npm run build -w @pensiv-plugins/canvas-checklist
node scripts/pack-plugin.mjs plugins/canvas-checklist   # → canvas-checklist.pnsv-plugin
```

### Looking native

The card ships its own [`styles.css`](src/styles.css) — the app's Tailwind build
never scans this repo — but every value is a host design token
(`--foreground`, `--primary`, `--border`, `--radius`, …), so it tracks the active
theme and the user's text-size setting. The pieces are ports of what the app
already draws, not new inventions:

| Piece             | Ported from                                                  |
| ----------------- | ------------------------------------------------------------ |
| checkbox          | the editor task list (`tiptap.css → input[type='checkbox']`) |
| progress track    | the Daily Goal / Document Goal widget track                  |
| add & delete      | `Button variant="ghost"` (hover wash, `active:scale-[0.98]`) |
| body padding/size | `NoteNode` (`p-2`, `text-sm`)                                |

A plugin node should be indistinguishable from a native one until you read what
it says. Labels are localized (en / ko / ja) through `LocalizedText`, like every
native string.

### The split

You render the inside. The host owns everything else:

| Host                                         | Plugin                    |
| -------------------------------------------- | ------------------------- |
| position, size, selection, z-order, grouping | the inner React component |
| undo / redo, copy / paste, delete            | an opaque `state`         |
| persistence, sync, export, version history   | —                         |

Do not draw a frame, a resizer, or connection handles — the host already has.

### `state`

`setState(next)` is the whole persistence story: the value rides the canvas's
normal debounced writer, so it lands on the same undo stack and syncs like any
other node edit. There is no separate save call.

It is **capped at 16 KB serialized**, and returns `false` when a write is
refused. That is not arbitrary: a canvas's nodes and edges live in **one** JSON
blob that is read and written whole, so per-node state is multiplied by the node
count and paid on every load — and on Android an oversized row is a hard
`CursorWindow` crash on read, not just a slow save. Anything larger belongs in
`app.storage`, with only a key on the node.

```ts
const ok = setState({ items: next });
if (!ok) app.ui.toast('This checklist is full — start a new node.');
```

### `readOnly`

The same component renders in version-history previews and export layouts with
`readOnly: true`. Show the value and hide the controls — a checkbox that silently
does nothing is worse than no checkbox.

### Ids without `Math.random()` or `Date.now()`

Two clients editing one canvas will both generate ids. Anything drawn from a
clock or an RNG drifts between them, so this example derives ids from the
existing rows instead — deterministic for a given state.

### What happens when the plugin is gone

Nothing is lost. Uninstall the plugin (or disable it, or rename the `viewId`) and
the host draws a neutral placeholder naming it, leaving position, size, edges and
`state` untouched. Reinstalling reattaches to the same nodes. A plugin going away
must never delete a user's canvas content.
