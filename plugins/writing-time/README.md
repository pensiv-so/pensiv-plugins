# Writing Time

Reference example for the **session lifecycle** — a live "time spent writing
today" counter, shown as a floating card, a tray chip, and a sheet.

## Use it

```bash
# from the monorepo root
npm install
npm run build -w @pensiv-plugins/writing-time
```

## What it shows

- `session.activeMs()` — active writing time today.
- `session.on('write-start' | 'write-stop' | 'tick')` — the lifecycle stream.
- `session.today()` — word/character totals, for context.
- `registerWidget` with `component` + `chip` + `sheet` — one plugin, three
  surfaces, one shared state hook so they can never disagree.
- `formFactors` on a setting field — the "floating widget" toggle is hidden on
  phones, which use the tray chip instead.
- `ui.openSheet(node)` — hand the host a body and let it pick the surface: a
  dialog on desktop, a real bottom sheet on mobile.

## What `activeMs` actually measures

Writing time, not app-open time. The host accumulates wall clock between
consecutive edits and drops any gap longer than its idle window, so stepping away
does not inflate the number. It is device-local (summing across devices would
double-count overlapping sessions) and resets at local midnight.

`tick` only fires during a writing stretch, which is what makes the live counter
cheap — no interval of your own, and nothing running while the user reads.

## Permissions

`session`.
