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

| Method                                                                 | Contributes                                                                                    |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `addCommand({ id, name, run })`                                        | palette / shortcut action (`name` is `LocalizedText`)                                          |
| `registerWidget({ id, surface, frame?, component, chip?, sheet?, … })` | a multi-surface widget — see below                                                             |
| `registerEditorExtension(ext)`                                         | a TipTap extension                                                                             |
| `addSettingTab({ title?, schema })`                                    | a settings form (declarative `SettingsSchema`)                                                 |
| `registerHeaderAction(...)`                                            | a file-header button (`onClick` / `isActive`)                                                  |
| `registerAppHeaderAction({ id, label, icon, onClick? \| render? })`    | a project app-header button; pass `render` for a **live custom button + popover** (e.g. Timer) |
| `registerPaneView(...)` / `registerPane(...)`                          | side-pane / full-tab views                                                                     |
| `registerSidebarItem(...)`                                             | a sidebar entry/section                                                                        |

Every `registerX` returns a disposer and is torn down automatically on disable.

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
- `app.ui` — `toast(msg)`, `openSheet(node)`, `openPane(id)`, `openSettings()`.
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
2. `react`, `react-dom`, `@pensiv/plugin-sdk`, `@tiptap/core` are provided by the
   host — keep them external (the shared build config does this).
3. Keep manifest + settings JSON-serializable.
4. Declare the minimum permissions.

Start from [`plugins/sample-plugin`](plugins/sample-plugin) for the minimal shape;
study [`plugins/timer`](plugins/timer) as the reference for anything stateful or
multi-surface (see the patterns above).
