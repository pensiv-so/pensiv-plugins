# Unit Converter

Length, weight, area, volume, temperature, speed and time — docked in the side
pane of every file type, and as an optional floating widget. Including the units
period fiction is actually written in.

## Features

- Seven categories, with the pair of units remembered per category
- **Old East Asian units** (척관법 / 尺貫法): 尺 · 寸 · 間 · 里 (Korean _and_ Japanese),
  斤 · 錢 · 貫, 坪 · 段 · 町, 홉 · 되 · 말 — switchable off in one toggle
- Temperature handled properly (°C / °F / K have different zero points, not a ratio)
- A rate line under the result — `1 mi = 1.6093 km` — so the conversion is checkable
- Swap the units and the number comes with them
- **Copy** or **insert** into the open document or sheet: the result, the number
  alone, or both sides (`5 mi = 8.0467 km`)
- Four surfaces from one state: side pane, floating widget, phone tray chip, bottom sheet
- Command: `Unit Converter: Toggle floating widget`

## Usage

Enable the plugin and a converter toggle appears in the header of every file —
document, sheet, plotboard, canvas, folder view or task. Click it and the
converter docks in that file's side pane, beside the editor. Pick a category,
type a number; it stays there while you write the line it belongs in.

Prefer it floating over the text? Settings → Unit Converter → **Show floating
widget**, or run the toggle command. Both surfaces share one conversion.

Precision, whether the old units are offered, and what the insert button writes
live in the same settings tab.

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
