# Authoring a pensiv plugin (agent reference)

This file is written for a coding agent (Claude Code / Cursor). It is the
manufactured context that lets you author a pensiv plugin reliably. The contract
follows a familiar typed `Plugin` API — if you've authored plugins against one
before, your priors transfer.

## The shape

A plugin is a folder with a `manifest.json` and a `src/main.ts` that
`export default`s a class extending `Plugin` from `@pensiv/plugin-sdk`. It builds
(via vite + `@pensiv/build-config`) to a single ES module `main.js` (+ optional
`styles.css`) that the pensiv app installs.

```ts
import { Plugin } from '@pensiv/plugin-sdk';

export default class MyPlugin extends Plugin {
  onload() {
    // register everything here; it is torn down automatically on disable
    this.addCommand({ id: 'do-it', name: 'Do it', run: () => this.app.ui.toast('done') });
  }
  onunload() {} // optional extra teardown
}
```

## manifest.json

```jsonc
{
  "id": "com.example.my-plugin", // reverse-DNS, unique, required
  "name": "My Plugin",
  "version": "1.0.0", // semver
  "sdk": "^1.0.0", // Host API range you built against
  "source": "marketplace",
  "permissions": ["editor.read"], // see Permissions below; [] for none
  "platforms": ["desktop", "web"], // code plugins are desktop/web (Apple §2.5.2)
  "contributes": { "commands": [{ "id": "do-it", "name": "Do it" }] }
}
```

## Lifecycle

- `onload()` runs every time the plugin is **enabled**. Register all
  contributions here.
- Disabling runs `onunload()` then disposes every contribution automatically;
  re-enabling re-runs `onload()`.
- Every `registerX(...)` returns a disposer you may call yourself; or use
  `this.register(fn)` to attach arbitrary teardown.

## What you can register (on `this`)

| Method                                                                               | Contributes                                                                                         |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `addCommand({ id, name, run })`                                                      | palette / shortcut action (`name` is `LocalizedText`)                                               |
| `registerWidget({ id, surface, frame?, component, chip?, sheet?, … })`               | a multi-surface widget — see below                                                                  |
| `registerEditorExtension(ext)`                                                       | a TipTap extension                                                                                  |
| `addSettingTab({ title?, schema })`                                                  | a settings form (declarative `SettingsSchema`)                                                      |
| `registerHeaderAction(...)`                                                          | a file-header button (`onClick` / `isActive`)                                                       |
| `registerAppHeaderAction({ id, label, icon, onClick? \| render? })`                  | a project app-header button; pass `render` for a **live custom button + popover** (e.g. Timer)      |
| `registerPaneView(...)` / `registerPane(...)`                                        | side-pane / full-tab views — rendered **full-bleed** (no host padding), so the view owns its insets |
| `registerSidebarItem(...)`                                                           | a sidebar entry/section                                                                             |
| `registerSurfaceItem({ surface, id, label, icon?, when?, onClick?, render? })`       | an item in **any** catalogue surface — context menus, the canvas selection toolbar, the pane strips |
| `registerCanvasNode({ id, name, icon?, defaultSize?, createDefaultState?, render })` | a plugin-owned node type on the canvas                                                              |
| `registerGraphSource({ id, nodes, links?, paintNode? })`                             | nodes/links overlaid on the relationship graph                                                      |
| `registerGraphFilter({ id, label, test, defaultEnabled? })`                          | a togglable graph filter, shown in graph preferences                                                |

Every `registerX` returns a disposer and is torn down automatically on disable.

### Surface items are the generic escape hatch (`registerSurfaceItem`)

Rather than one `registerX` per menu, name a surface from the catalogue
([`surfaces.ts`](packages/plugin-sdk/src/surfaces.ts), the source of truth):

| Surface id                            | Where it appears                                              | `target`                                       |
| ------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `file.menu`                           | right-click a file in the project tree **or** the folder grid | the file                                       |
| `editor.menu`                         | right-click inside the document / sheet editor (desktop)      | the selection (`target.text` + `target.range`) |
| `editor.selection`                    | the floating toolbar over selected text (all platforms)       | the selection (`target.text` + `target.range`) |
| `plotcard.menu` / `plotpartcard.menu` | the card's "…" menu                                           | the card                                       |
| `canvas.selection`                    | the canvas selection toolbar                                  | the selected node(s)                           |
| `pane.toolbar` / `pane.statusbar`     | strips above / below the pane's content                       | the pane's file                                |

The two editor surfaces are the same target from two entry points — the toolbar
is the fast path, the context menu the discoverable one — so an item that acts on
selected text usually registers on both. Register `editor.selection` if you want
to exist on phones and tablets: `editor.menu` hangs off a right-click, which
touch has no equivalent of.

`target.range` is the selection's `{ from, to }` in ProseMirror positions,
**snapshotted when the surface opened**. Anchor to it rather than calling
`app.editor.getSelection()` inside `onClick`: opening a menu takes focus and a
toolbar tap can collapse the selection, so by click time the live selection may
no longer be what the user highlighted.

Menu surfaces render your item as a row at the end of the menu, under a
separator — a bottom-sheet row on phones, where those menus are sheets. The rest
render inline: an icon button, or your own `render` component.

Two independent knobs narrow where an item shows:

- `fileTypes` / `viewModes` — **static, omit-to-allow.** Leaving them out means
  every value, including file types pensiv adds later, so a published plugin
  never disappears because the app grew.
- `when(ctx)` — **dynamic.** Re-evaluated on every render, with the live
  `target`. A `when` that throws hides its item (fail closed).

`ctx.target` is a convenience the host had at hand — enough to decide visibility
and label a row. For anything authoritative, read the entity:
`ctx.app.project.get(ctx.target.id)`. `ctx.targets` carries the whole
multi-selection where the surface has one.

Callbacks run in-process on host render paths, so the host guards them: a throw
is caught and reported, and an item that throws three times is disabled for the
session — that one item, not the plugin and not the surface. Re-enabling the
plugin re-arms it. See [`plugins/surface-actions`](plugins/surface-actions) for a
worked example of every surface above, including a deliberately-crashing row.

### Canvas nodes (`registerCanvasNode`)

A plugin can put its own object on a canvas, added from the canvas toolbar next
to the built-in note / file / image cards.

The **host** owns position, size, selection, z-order, grouping, undo/redo,
copy/paste, persistence, sync, export and cascade delete. The **plugin** owns the
inner React component and an opaque `state` — nothing else. Don't draw a frame, a
resizer, or connection handles.

Plugins do **not** widen the app's node-type union. Every plugin node is one host
`type: 'plugin'` node carrying `{ pluginId, viewId, state }`, so the dozens of
places that compare node kinds keep working, and a node whose plugin is
uninstalled degrades to a neutral placeholder with its data intact rather than
disappearing.

`setState(next)` writes through the canvas's normal debounced writer — same undo
stack, same sync, no separate save. It is **capped at 16 KB serialized** and
returns `false` when refused: canvas content is one JSON blob read and written
whole, so per-node state is paid on every load, and on Android an oversized row
is a hard crash. Keep anything larger in `app.storage` and put a key on the node.

The view also receives `readOnly`, which is `true` in version-history previews
and export layouts — render the value, hide the controls. See
[`plugins/canvas-checklist`](plugins/canvas-checklist) for a worked example.

### The relationship graph (`registerGraphSource` / `registerGraphFilter`)

The graph is a `react-force-graph-2d` canvas — no child components to slot into.
So instead of exposing the view, pensiv exposes the seams that decide **what is
in the graph** (`registerGraphSource`), **what stays visible**
(`registerGraphFilter`), and **how your own nodes look** (`paintNode` on a
source). Plus the `graph.toolbar` and `graph.node-menu` surfaces.

A source's nodes are **virtual**: graph-only, never written, never synced, inert
on click. The host namespaces their ids so they can't collide with an entity. For
a node that persists, create a real entity through `app.project` instead — the
graph picks it up with no plugin code on the render path.

Link endpoints are either your own node ids or **raw entity ids**; the host
resolves which and drops anything that matches neither.

Everything here is hot: `nodes()`/`links()` per rebuild, `test()` per node,
`paintNode()` **per node per frame**. `paintNode` runs inside a
`save()`/`restore()` pair (a leaked transform would corrupt every later node) and
inside the throw guard. Filters narrow rather than union, a hidden node takes its
links with it, and they start **off** — installing a plugin must never silently
hide part of someone's graph. See [`plugins/graph-tags`](plugins/graph-tags).

### Widgets are multi-surface (`registerWidget`)

`registerWidget` is the most undersold call: one registration can paint up to
**three host surfaces** from one shared component/state, and the host owns all the
chrome. The summary `{ id, surface, frame?, component }` is the floor, not the
ceiling — the full shape (see [`widget.ts`](packages/plugin-sdk/src/widget.ts),
the source of truth):

| Field                                       | What it does                                                                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `surface`                                   | `'floating' \| 'pane' \| 'sheet' \| 'any'` — where it may mount                                                                                                |
| `frame`                                     | `'floating'` = host draws the draggable, corner-snapping chrome; your `component` returns **only inner content**. `'none'` (default) = host mounts it bare     |
| `component`                                 | the desktop/tablet React body (`FC<WidgetProps>`, gets `{ app, projectId }`)                                                                                   |
| `defaultCorner` / `storageKey`              | initial corner + persisted corner/stack-order key, for `frame: 'floating'`                                                                                     |
| `shouldRender(ctx)`                         | mount gate for `component`; re-evaluated as settings/project change. Return `false` and nothing mounts (e.g. a "show floating widget" toggle)                  |
| `chip`                                      | a **compact** body for the host's pill/tray surface (mobile). Inner content only — host owns the pill + tap-to-open, and opens `sheet` (or `component`) on tap |
| `chipShouldRender(ctx)` / `chipAccent(ctx)` | independent visibility gate + accent-ring gate for the chip (falls back to `shouldRender`)                                                                     |
| `sheet`                                     | a phone bottom-sheet body opened from the chip; falls back to `component`                                                                                      |

`component`, `chip`, and `sheet` should share **one piece of state** so all
surfaces stay in lockstep — see the Timer reference below for how. Never import
app internals; everything you need is on `props.app`.

## The Host API (`this.app`)

The only way to touch the app. Sub-objects: `editor`, `project`, `session`,
`storage`, `ui`, `platform`, `app`. Gated methods throw without the matching
granted permission.

- `app.editor` — `getText()`, `count(opts?)`, `getSelection()`, `insert(t)`
  `[editor.write]`, `setContent(doc, { resetHistory })` `[editor.write]`,
  `on('update'|'selectionUpdate', cb)`, `decorate(ranges)` `[editor.read]`.
- `app.session` — `today()` → `{ added, removed, net }` words+chars,
  `wordsToday()`, `on('change'|…, cb)`. `[session]`
- `app.storage` — `get(key)` / `set(key, value, { scope })` (per-plugin
  namespace; `scope:'synced'` needs `[storage.synced]`), `on(key, cb)`.
- `app.project` — the file tree, plot cards and relationships (see
  [`project-api.ts`](packages/plugin-sdk/src/project-api.ts)), plus
  `content(id)` `[project.read]`: the body of a **document or sheet** as
  `{ doc, text }`. That is the only way to read text outside the file being
  edited, so it is what a manuscript-wide index or coverage stat is built on.
  `doc` is a copy, cloned on first access — reading just `text` costs nothing.
- `app.ui` — `toast(msg)`, `openSheet(node, { title? })` + `closeSheet()`,
  `openPane(id)`, `openSettings()`, `openFile(fileId, { range?, split? })`
  `[project.read]`. `openSheet` renders your body in host chrome (dialog on
  desktop, bottom sheet on mobile) with the optional `title` in its header;
  `closeSheet` dismisses your own sheet — for pickers, where choosing a row is
  also the dismissal. `openFile` is the navigation half of `app.project`: it
  opens the file in the split view and, with a `range`, scrolls to that span
  and pulse-highlights it once the editor has loaded — so a row in your pane
  behaves like the app's own results.
- `app.platform` — `clipboard`, `notify()` `[notifications]`, `playSound(name)`,
  `now()`, `timer(ms, cb)`, `fetch(url)` `[net:<host>]`, `openExternal(url)`.
- `app.app` — read-only context: `projectId`, `fileId`, `fileType`
  (`document`|`sheet`|`plotboard`|…, to scope a widget to one pane kind),
  `route`, `locale` (`en`|`ko`|`ja`), `platform` (`desktop`|`mobile`|`web`, for
  surface-appropriate UI).

For your own rendered strings, type them as `LocalizedText` and resolve with
`resolveLocalizedText(text, app.app.locale)` (exported from the SDK — the same
resolution the host uses for schema labels). See the i18n recipe below.

## Permissions

Declare in the manifest; the user grants them at install. Names are explicit so
you can pick the right one: `editor.read`, `editor.write`, `editor.intercept`,
`project.read`, `project.write`, `session`, `storage.synced`, `clipboard`,
`notifications`, `net:<host>` (e.g. `net:api.example.com`). Declare the minimum.

## Settings schema (declarative, no UI code)

`addSettingTab({ schema })`. Field types: `toggle`, `text`, `number`, `select`,
`radio`, `list` (array of primitives), `object-list` (add/remove/reorder rows),
plus `group` sections. Each field's value persists under its `key` in your
`app.storage`; read it with `app.storage.get(key) ?? field.default`. Gate fields
with `visibleWhen` / `disabledWhen` on a sibling field's value.

## Reference plugin: Timer (patterns for non-trivial plugins)

[`plugins/sample-plugin`](plugins/sample-plugin) shows the floor — one command,
one settings tab, one editor read. A real plugin like
[`plugins/timer`](plugins/timer) is bigger because it solves problems the sample
never hits: **multiple surfaces showing the same live state, refresh-survival, and
localization.** None of that is automatic — these are the patterns that make it
work. Read them before authoring anything stateful or multi-surface; copy the
recipes.

### 1. One shared store across every surface

The Timer's app-header button, floating widget, mobile chip, and sheet must show
the _same_ countdown — start it in one and the others update instantly. Do **not**
reach for React state/context (each surface mounts independently, so they'd
diverge). Use a **module-level singleton store** that every surface imports, with a
tiny external-store subscription hook. See [`store.ts`](plugins/timer/src/store.ts):

```ts
// store.ts — one instance, imported by every surface.
class TimerStore {
  remainingSeconds = 0;
  private listeners = new Set<() => void>();
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private notify() {
    this.listeners.forEach((fn) => fn());
  }
  setRemainingSeconds(s: number) {
    this.remainingSeconds = s;
    this.persist();
    this.notify();
  }
  // …timers, persistence…
}
export const timerStore = new TimerStore();

// The subscription hook every component uses (re-render on any change):
export function useTimerStore(): TimerStore {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => timerStore.subscribe(forceUpdate), []);
  return timerStore;
}
```

Because the surfaces are bundled into one plugin, they import the _same_ module
instance — that's what keeps them in lockstep. (`useSyncExternalStore` works too;
the `useReducer` force-update is the minimal form.)

### 2. Split ephemeral run-state from durable settings

Two different homes, on purpose:

- **Durable, user-facing config** (presets, mode, "show floating widget") →
  `app.storage` so it's namespaced, synced across devices (`scope: 'synced'` with
  `[storage.synced]`), and editable from your settings schema. Read it back as
  `app.storage.get(key) ?? field.default`.
- **Ephemeral run-state** (what's counting _right now_, seconds remaining) →
  the store, which persists _itself_ to a plain `localStorage` key so a refresh
  resumes mid-countdown. This is on-device, high-frequency, not a setting — keep it
  out of `app.storage`.

Components push durable settings _into_ the store on change (e.g. `useEffect` that
calls `store.setMode(app.storage.get('mode'))`), so the store stays the single
source of truth the surfaces render from. See [`widget.tsx`](plugins/timer/src/widget.tsx).

### 3. Wire all three widget surfaces from one `registerWidget`

One registration, one shared store, three host-framed surfaces:

```ts
this.registerWidget({
  id: 'timer',
  surface: 'floating',
  frame: 'floating', // host draws the draggable card chrome
  defaultCorner: 'bottom-right',
  storageKey: 'pensiv:plugin:timer:corner',
  shouldRender: ({ app }) => app.storage.get<boolean>('showFloatingWidget') ?? false,
  chipShouldRender: ({ app }) => app.storage.get<boolean>('showChip') !== false,
  component: TimerFloatingWidget, // desktop/tablet card body
  chip: TimerChip, // mobile tray pill body
  sheet: TimerSheet // mobile bottom-sheet body
});
```

`component`, `chip`, and `sheet` all call `useTimerStore()` — so they're just three
views of the same state. Gate the floating card and the chip independently
(`shouldRender` vs `chipShouldRender`) when their visibility differs by surface.

### 4. Localize your own rendered strings

Schema labels take `LocalizedText` and the host resolves them, but strings _your_
components render you resolve yourself. The Timer's
[`i18n.ts`](plugins/timer/src/i18n.ts) is the whole recipe — a tiny literal helper
plus a resolver over `app.app.locale`:

```ts
import { resolveLocalizedText, type HostApi, type LocalizedText } from '@pensiv/plugin-sdk';

export const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });
export const STR = { start: L('Start', '시작', '始める') /* … */ } as const;
export const tr = (app: HostApi, text: LocalizedText): string =>
  resolveLocalizedText(text, app.app.locale);

// in a component:  tr(app, STR.start)  →  "시작" when locale is ko
```

(There's no SDK-level i18n module by design — the SDK is mirror-generated and
stays a thin contract; `resolveLocalizedText` is the one primitive it exports, and
this `L`/`tr`/`STR` wrapper is the convention to copy.)

### 5. Wire host side-effects once, and tear them down

Effects that should fire once for the whole plugin (not per-surface) belong in
`onload`, registered against the plugin lifecycle — not inside a component:

```ts
onload() {
  timerStore.onComplete = () => this.app.platform.playSound('Ping'); // chime once
  this.register(() => { timerStore.onComplete = null; });            // undo on disable
}
```

`this.register(fn)` attaches arbitrary teardown to the same lifecycle that disposes
your contributions — use it for any global wiring (store callbacks, listeners) you
set up by hand.

## Rules that keep you compatible

1. Import only from `@pensiv/plugin-sdk`. Never reach into pensiv internals.
2. `react`, `react-dom`, `@pensiv/plugin-sdk`, `@tiptap/core` and `@tiptap/pm/*`
   are provided by the host — keep them external (the shared build config does
   this). Never add ProseMirror (`@tiptap/pm`, `prosemirror-*`) to your own
   dependencies: the host identifies ProseMirror objects with `instanceof`, so a
   second copy is invisible until it breaks. A `DecorationSet` built by a bundled
   copy fails `instanceof DecorationSet` in the host's `DecorationGroup.from`,
   which flattens it as `undefined` — after that every editor redraw throws
   "Cannot read properties of undefined (reading 'localsInner')" and the editor
   is dead until reload.
3. Keep manifest + settings JSON-serializable.
4. Declare the minimum permissions.

Start from [`plugins/sample-plugin`](plugins/sample-plugin) for the minimal shape;
study [`plugins/timer`](plugins/timer) as the reference for anything stateful or
multi-surface (see the patterns above).

## Publishing to the marketplace

The marketplace lists plugins from **source** — `manifest.json` + `src/**` —
which pensiv's server builds itself (esbuild over a virtual FS, no `npm
install`). What you must know when authoring for publication:

- **Imports are allowlisted.** Only relative files inside the plugin plus the
  host modules `react`, `react-dom`, `react/jsx-runtime`, `@pensiv/plugin-sdk`,
  `@pensiv/plugin-ui`, `@tiptap/core`, `@tiptap/pm/*`. Any other bare import
  fails the build — vendor such code as source files you own.
- **Caps**: ≤ 100 source files, ≤ 2 MB total, ≤ 512 KB per file. Entry is
  `src/main.ts(x)` unless specified.
- **Permissions are validated strictly**: only the known set, and any `fetch`
  target needs its own `net:<host>` (bare lowercase hostname — no scheme, port,
  wildcard, IP, or localhost).
- **Version must strictly increase** on every republish of the same manifest
  `id` (same author + same id ⇒ new version of the existing listing).
- **`so.pensiv.*` is reserved** for first-party plugins; publish under your own
  reverse-DNS namespace.
- Everything lists immediately as **Unreviewed**: the listing shows the declared
  permissions and the app asks for consent before running any code. A root
  `README.md` seeds the listing description, and `screenshots/*` seed the
  gallery, when publishing via the web wizard.
- Because `README.md` becomes the listing, keep it **user-facing only** — what
  the plugin does, how to use it, no implementation detail. Engineering notes
  (design decisions, host-API patterns, traps) go in the plugin's
  `DEVELOPER.md`; see `llms.txt` for the index of those.

Publish at <https://pensiv.so/community/publish/plugin> (folder or
`npm run bundle-source plugins/<name>` zip), or in-app via Settings → Plugins →
_Publish a plugin_.
