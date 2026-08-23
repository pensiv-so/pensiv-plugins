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

## Permissions

`editor.read`, `editor.write` — read the document to find live blocks, insert and refresh them.
`project.read` — list character sheets and order the episodes.
`storage.synced` — keep sheets and per-episode values across your devices.

It never writes to your character sheets.

## Development

```bash
npm run build     -w @pensiv-plugins/status-window
npm run typecheck -w @pensiv-plugins/status-window
npx vitest run plugins/status-window/test/
node scripts/pack-plugin.mjs plugins/status-window
```

The format research the presets are built from is in the app repo at `docs/status-window-formats.md`.
