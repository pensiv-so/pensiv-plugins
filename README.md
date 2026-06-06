# pensiv-plugins

Public monorepo for the [Pensiv](https://pensiv.so) plugin ecosystem: the SDK
every plugin is authored against, the authoring kit, and Pensiv's own
first-party plugins — all installed through the same pipeline a third party uses
(nothing is baked into the app).

> A typed SDK + a canonical sample plugin + a public corpus of real plugins, so
> a coding AI (Claude Code / Cursor) can author a Pensiv plugin reliably.

## Layout

```
packages/
  plugin-sdk/            @pensiv/plugin-sdk — the typed contract (Plugin, HostApi, …)
  build-config/          shared vite lib build (externalizes react + the sdk)
  create-pensiv-plugin/  scaffold CLI (clones sample-plugin)
plugins/
  sample-plugin/         pensiv-sample-plugin — canonical clone-and-edit starter
  …                      first-party plugins (timer, daily-goal, …) land here
AGENTS.md  llms.txt      the AI-authoring corpus
```

## Authoring a plugin

A plugin is a small package: a `manifest.json`, a `src/main.ts` that
`export default class extends Plugin`, an optional `styles.css`, and a vite
config extending `@pensiv/build-config`. It builds to a `.pnsv-plugin` artifact
the Pensiv app installs.

```ts
import { Plugin } from '@pensiv/plugin-sdk';

export default class MyPlugin extends Plugin {
  onload() {
    this.addCommand({ id: 'hello', name: 'Say hello', run: () => this.app.ui.toast('hi') });
  }
}
```

Start from [`plugins/sample-plugin`](plugins/sample-plugin). See
[AGENTS.md](AGENTS.md) and [llms.txt](llms.txt) for the full contract reference.

## SDK source of truth

`@pensiv/plugin-sdk` is **mirror-generated from the Pensiv app** (where the host
adapter that implements the contract lives), so the published `.d.ts` can never
drift from the running implementation. Do not hand-edit `packages/plugin-sdk/src`
beyond the mirror — change the contract in the app and re-mirror.

## Status

Bootstrap skeleton. Plugin-system rebuild is in progress; see the app repo's
`docs/future-plan/2026-06-03-plugin-system-rebuild.md`.
