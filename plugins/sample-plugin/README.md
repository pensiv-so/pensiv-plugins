# Sample Plugin

The canonical pensiv plugin — the clone-and-edit starting point.

## Use it

```bash
# from the monorepo root
npm install
npm run build -w @pensiv-plugins/sample-plugin
```

This produces `dist/main.js` (+ `dist/styles.css` if you add CSS), which the
pensiv app packages into a `.pnsv-plugin` and installs.

## What it shows

- `addCommand` — a palette/shortcut action.
- `addSettingTab` with a declarative `schema` — the host renders the form.
- reading the editor via the typed `this.app` Host API (`editor.count`),
  gated by the `editor.read` permission declared in `manifest.json`.

Edit `src/main.ts` and `manifest.json` (change the `id` to your own reverse-DNS
namespace) to make it yours.
