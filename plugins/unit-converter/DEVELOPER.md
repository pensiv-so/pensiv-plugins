# Unit Converter — developer notes

> Moved out of `README.md` so the marketplace listing stays purely
> user-facing. Everything below is for plugin authors reading the source.

## How it works

- **One base unit per category.** [`src/units.ts`](src/units.ts) is a table: every
  unit carries its ratio to the category's base, so a conversion is
  `value × from.ratio ÷ to.ratio`. Temperature is the exception — °C, °F and K
  disagree about where zero is, so those units carry explicit to/from-base
  functions instead.
- **Exact definitions, not rounded decimals.** An inch _is_ 0.0254 m, a pound _is_
  0.45359237 kg, 1 尺 _is_ 10/33 m, 1 坪 _is_ 400/121 m². Writing the definitions
  rather than their decimal expansions is what makes a round trip land back where
  it started — which [`test/units.test.ts`](test/units.test.ts) checks for every
  unit in every category.
- **The old units are a filter, not a category.** They live in the same tables as
  their modern neighbours, flagged `historical`, so you can convert 평 → m² in one
  step instead of switching modes. The 1891 Japanese standardisations are used
  (Korea shared them administratively from 1902); earlier regional 尺 differ, and a
  novel set before that should treat them as an approximation.
- **One store, every surface.** A module-level singleton
  ([`src/store.ts`](src/store.ts)) holds what you are converting and persists
  _itself_ to a `localStorage` key; durable preferences live in `app.storage` via
  the settings schema.
- **A pane, not a dialog.** `registerPaneView` docks the converter beside the
  editor: you convert a distance mid-sentence, and a modal hides the sentence.
- **Every file type, on purpose.** The pane view is registered with no
  `fileTypes` filter — `SurfaceScope` is omit-to-allow, so the toggle appears in
  every file type, including ones pensiv adds later, with no republish.
- **The controls are the app's controls.** [`src/styles.css`](src/styles.css) ports
  `Button` and the `Tabs` treatment from the app (same variants, sizes, focus
  ring) and reads the host tokens, so the category strip and the unit pickers are
  the app's own, on the user's theme and accent.

## Permissions

- `editor.write` — only for the insert button.
- `clipboard` — only for the copy button.
