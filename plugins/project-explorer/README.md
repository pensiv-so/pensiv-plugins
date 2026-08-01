# Project Explorer

Reference example for **`app.project`** — reading the project's file tree,
following its relationship graph, and writing back to both.

## Use it

```bash
# from the monorepo root
npm install
npm run build -w @pensiv-plugins/project-explorer
```

## What it shows

- `project.children(id)` / `project.get(id)` — walking the tree.
- `project.relationships(id, type)` — the cross-cutting link graph.
- `project.subscribe(cb, kinds?)` — re-render on change instead of polling.
- `project.create` / `project.link` / `project.unlink` — writes that go through
  the app's own optimistic paths.
- `app.pane.selection` — acting on what the user has selected in the focused pane.
- `registerPaneView` with no `fileTypes` / `viewModes`, so the pane is offered on
  every file type.

## Three things the code is careful about

**Any file can parent any file.** The tree walk never checks `type === 'folder'`.
A folder is one of the five file types, not a container concept — a document can
hold a sheet, a canvas can hold a document. Code that special-cases folders will
silently miss most of a real project.

**Snapshots are frozen and do not update themselves.** Everything a read returns
is an immutable copy, safe to hold across a render — but you must re-read when
`subscribe` fires. Mutating one throws.

**`unlink` is a hard delete.** Relationship removal deletes the row; there is no
deactivate and no undo. The click-to-remove in the backlinks list really removes
it.

## Permissions

`project.read` to read, `project.write` to create/link/unlink. They are gated
independently, so a read-only fork can drop `project.write` from the manifest.
