# Canvas Checklist

Reference example for **`registerCanvasNode()`** — a plugin's own object on the
canvas, added from the canvas toolbar next to the built-in note, file and image
cards.

## Use it

```bash
# from the monorepo root
npm install
npm run build -w @pensiv-plugins/canvas-checklist
```

Install `canvas-checklist.pnsv-plugin`, open a canvas, and pick **Checklist**
from the plugin-nodes button in the toolbar (or right-click empty canvas).

## The split

You render the inside. The host owns everything else:

| Host                                         | Plugin                    |
| -------------------------------------------- | ------------------------- |
| position, size, selection, z-order, grouping | the inner React component |
| undo / redo, copy / paste, delete            | an opaque `state`         |
| persistence, sync, export, version history   | —                         |

Do not draw a frame, a resizer, or connection handles — the host already has.

## `state`

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

## `readOnly`

The same component renders in version-history previews and export layouts with
`readOnly: true`. Show the value and hide the controls — a checkbox that silently
does nothing is worse than no checkbox.

## Ids without `Math.random()` or `Date.now()`

Two clients editing one canvas will both generate ids. Anything drawn from a
clock or an RNG drifts between them, so this example derives ids from the
existing rows instead — deterministic for a given state.

## What happens when the plugin is gone

Nothing is lost. Uninstall the plugin (or disable it, or rename the `viewId`) and
the host draws a neutral placeholder naming it, leaving position, size, edges and
`state` untouched. Reinstalling reattaches to the same nodes. A plugin going away
must never delete a user's canvas content.
