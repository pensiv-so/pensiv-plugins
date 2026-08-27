# Status Window — developer notes

> Moved out of `README.md` so the marketplace listing stays purely
> user-facing. Everything below is for plugin authors reading the source.

## Templates

A mustache subset: `{{name}}`, `{{#section}}…{{/section}}`, `{{^section}}…{{/section}}`, `{{.}}`, dotted paths.

```
=====
{{#rows}}{{#cells}}{{name}} : {{value}}{{^last}}   {{/last}}{{/cells}}
{{/rows}}=====
```

Top level: `characterName`, `episodeTitle`, `episodeNumber`, `attributes`, `groups`, `rows`, `changed`, `by`.
Per attribute: `name` (padded), `rawName`, `value`, `rawValue`, `raw`, `base`, `bonus`, `grade`, `note`, `cur`, `max`, `regen`, `percent`, `bar`, `items`, `prev`, `delta`, `arrow`, `pad`, `first`, `last`.

`{{by.<id>}}` addresses one attribute directly, for layouts that pack several onto a line:

```
名前：{{by.name.value}}　種族：{{by.race.value}}　Ｌv{{by.level.value}}
```

`prev` / `delta` / `arrow` / `{{#changed}}` compare against what the **current document** read before it touched the attribute — not against the previous episode. A document that changed nothing has an empty `changed` block.

## Storage

| Key | What |
| --- | --- |
| `schema:<charId>` | the character's attribute definitions |
| `values:<charId>` | the character's stats — global, read identically from every file |
| `delta:<fileId>:<charId>` | what this file changed, so it can be undone |
| `prev:<fileId>:<charId>` | what those attributes read before this file touched them — the arrow's baseline |
| `blocks:<fileId>` | which character each live block in this file is for |

`values:` is the state. `delta:`/`prev:` are annotations on it and are never folded in. Before 1.1.0 there was no `values:` key and `delta:` maps *were* the state, folded in episode order — see `storage.ts` for why that was wrong and how the one-time migration recovers it.

## Permissions

`editor.read`, `editor.write` — read the document to find live blocks, insert and refresh them.
`project.read` — list character sheets, order the episodes, and find pre-1.1.0 values during the one-time migration.
`storage.synced` — keep sheets and stats across your devices.

It never writes to your character sheets.

## Development

```bash
npm run build     -w @pensiv-plugins/status-window
npm run typecheck -w @pensiv-plugins/status-window
npx vitest run plugins/status-window/test/
node scripts/pack-plugin.mjs plugins/status-window
```

The format research the presets are built from is in the app repo at `docs/status-window-formats.md`.
