# pensiv-plugins

Public monorepo for the [pensiv](https://pensiv.so) plugin ecosystem: the SDK
every plugin is authored against, the authoring kit, and pensiv's own
first-party plugins — all installed through the same pipeline a third party uses
(nothing is baked into the app).

> A typed SDK + a canonical sample plugin + a public corpus of real plugins, so
> a coding AI (Claude Code / Cursor) can author a pensiv plugin reliably.

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
the pensiv app installs.

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

### One-shot with Claude

Don't want to read the contract yourself? **[➜ Build a plugin with Claude](<https://claude.ai/new?q=Build%20a%20pensiv%20writing-app%20plugin%20for%20me.%0A%0Apensiv%20plugins%20are%20small%20TypeScript%20packages%20authored%20against%20the%20%40pensiv%2Fplugin-sdk%20(a%20Plugin%20base%20class%20%2B%20a%20permission-gated%20Host%20API)%2C%20built%20to%20an%20ES%20module%20the%20app%20installs.%0A%0ABefore%20writing%20any%20code%2C%20read%20the%20authoring%20contract%20and%20SDK%20reference%3A%0A-%20https%3A%2F%2Fraw.githubusercontent.com%2Fpensiv-so%2Fpensiv-plugins%2Fmain%2FAGENTS.md%0A-%20https%3A%2F%2Fraw.githubusercontent.com%2Fpensiv-so%2Fpensiv-plugins%2Fmain%2Fllms.txt%0AUse%20https%3A%2F%2Fgithub.com%2Fpensiv-so%2Fpensiv-plugins%2Ftree%2Fmain%2Fplugins%2Fsample-plugin%20as%20the%20starting%20shape%20(manifest.json%20%2B%20src%2Fmain.ts%20%2B%20vite%20config)%2C%20and%20the%20timer%20plugin%20as%20the%20reference%20for%20anything%20non-trivial.%0A%0AThen%20build%20a%20plugin%20that%20does%20this%3A%0A%0A%3C%3C%3C%20DESCRIBE%20YOUR%20FEATURE%20HERE%20%3E%3E%3E>)** — opens [claude.ai](https://claude.ai) with a prompt pre-loaded to pull this repo's authoring contract. Just replace `<<< DESCRIBE YOUR FEATURE HERE >>>` with what you want the plugin to do.

## SDK source of truth

`@pensiv/plugin-sdk` is **mirror-generated from the pensiv app** (where the host
adapter that implements the contract lives), so the published `.d.ts` can never
drift from the running implementation. Do not hand-edit `packages/plugin-sdk/src`
beyond the mirror — change the contract in the app and re-mirror.

## Status

Bootstrap skeleton. Plugin-system rebuild is in progress; see the app repo's
`docs/future-plan/2026-06-03-plugin-system-rebuild.md`.
