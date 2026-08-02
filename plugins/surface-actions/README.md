# Surface Actions

Reference example for **`registerSurfaceItem()`** — the one call that puts an
item into any surface in the catalogue, rather than a different API per menu.

## Use it

```bash
# from the monorepo root
npm install
npm run build -w @pensiv-plugins/surface-actions
```

Then install `surface-actions.pnsv-plugin` from Settings → Plugins → Install from
file, and right-click a file in the sidebar.

## What it shows

| Surface            | Item               | Point being made                                                 |
| ------------------ | ------------------ | ---------------------------------------------------------------- |
| `file.menu`        | Copy file id       | one registration serves the sidebar tree **and** the folder grid |
| `file.menu`        | Count children     | any file type can have children — no `type === 'folder'` check   |
| `editor.menu`      | Selection stats    | `target.text` is the selection captured when the menu opened     |
| `plotcard.menu`    | Announce card      | a dropdown row on desktop, a bottom-sheet row on phones          |
| `canvas.selection` | Describe selection | `targets` carries the whole multi-selection                      |
| `pane.toolbar`     | Pane info          | `paneId` / `fileId` for the pane the item is rendered in         |
| `pane.statusbar`   | Word count         | a custom `render` for a live value                               |
| `file.menu`        | Crash on purpose   | what a throwing item actually costs                              |

## Scoping: two knobs, different jobs

```ts
this.registerSurfaceItem({
  surface: 'editor.menu',
  fileTypes: ['document'], // static:  never offered elsewhere
  when: (ctx) => !!ctx.target?.text // dynamic: depends on this invocation
  // ...
});
```

`fileTypes` / `viewModes` are **omit-to-allow**: leaving them out means every
value, including file types pensiv gains later, so a published plugin never
silently disappears because the app grew. List values only to narrow.

`when` runs on every render of the surface and sees the live `target`, so use it
for anything that depends on what the user actually clicked.

## `target` vs `app.project`

`target` is whatever the host had at hand when it rendered the surface — enough
to decide whether to show a row, and enough for a label. It is **not** the source
of truth. `target.title` may be missing, and it never carries the full entity.

```ts
const file = ctx.app.project.get(ctx.target.id); // authoritative
```

## What happens when an item throws

Plugin callbacks run in-process, on host render paths. A `when()` that throws
while a context menu is opening would otherwise take down the menu, so the host
guards every call:

1. It catches, logs with the plugin id, and carries on. `when` fails **closed** —
   a broken predicate hides its item rather than showing an unpredictable row.
2. After three throws it disables **that one item** for the session. Not the
   plugin, not the surface: a plugin with one bad row and five good ones loses
   exactly the bad row.
3. It toasts once, naming the plugin, so the failure is diagnosable instead of
   the row just quietly ceasing to exist.

Disabling and re-enabling the plugin clears that state, so a fix takes effect
without restarting the app. The `Crash on purpose` row exists to let you watch
all three steps happen.
