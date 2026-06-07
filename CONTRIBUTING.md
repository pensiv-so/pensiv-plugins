# Contributing to pensiv-plugins

Thanks for helping build the Pensiv plugin ecosystem. This repo is a public
authoring kit: the SDK plugins are written against, the shared build config, the
scaffold CLI, and a corpus of first-party plugins that double as worked examples.
Because the plugins **are** the documentation, we keep the whole tree typed,
linted, and tested.

## Prerequisites

- Node.js **>= 20** (`engines` is enforced)
- npm (this is an npm workspaces monorepo)

## Setup

```bash
npm install
```

That links every workspace under `packages/*` and `plugins/*`.

## The checks (run before you open a PR)

| Command | What it does |
| --- | --- |
| `npm run typecheck` | builds `@pensiv/plugin-sdk`, then type-checks the SDK **and every plugin** |
| `npm run lint` | ESLint across the repo |
| `npm test` | Vitest unit tests |
| `npm run build` | builds the SDK and bundles every plugin with vite |
| `npm run format` | formats with Prettier (optional, not enforced in CI) |

CI runs `typecheck`, `lint`, `build`, and `test` on Node 20 and 22. A PR must be
green on all four.

## Adding a plugin

1. Copy [`plugins/sample-plugin`](plugins/sample-plugin) to `plugins/<your-plugin>`.
2. In `manifest.json`, set a unique reverse-DNS `id` and your author info.
3. Add a `tsconfig.json` (copy the sample's) so your plugin is type-checked.
4. Build it: `npm run build -w @pensiv-plugins/<your-plugin>`.
5. Package the artifact: `npm run pack-plugin plugins/<your-plugin>`.

See [AGENTS.md](AGENTS.md) and [llms.txt](llms.txt) for the full authoring contract.

### Rules that keep a plugin compatible

- Import only from `@pensiv/plugin-sdk` (and `@pensiv/plugin-ui` for host UI).
  Never reach into Pensiv internals.
- Keep `react`, `react-dom`, `@pensiv/plugin-sdk`, and `@tiptap/core` external —
  the shared build config already does this.
- Keep `manifest.json` and settings schemas JSON-serializable.
- Declare the **minimum** permissions your plugin needs.

## Changing a published package

`@pensiv/plugin-sdk` is **mirror-generated from the Pensiv app** — do not
hand-edit `packages/plugin-sdk/src`. Change the contract in the app repo (where
the host adapter lives) and re-mirror.

For any change to a publishable package (`@pensiv/plugin-sdk`,
`@pensiv/build-config`, `@pensiv/plugin-ui`, `create-pensiv-plugin`), add a
changeset so the release is versioned and changelogged:

```bash
npx changeset
```

Pick the bump (patch/minor/major) and write a one-line summary. Commit the
generated file in `.changeset/` with your PR. Plugins under `plugins/*` are
private and are not published, so they don't need a changeset.

## Commit & PR

- Keep PRs focused; one logical change per PR.
- Reference any related issue.
- Make sure all four checks pass locally first.

By contributing you agree your work is licensed under the repo's [MIT license](LICENSE).
