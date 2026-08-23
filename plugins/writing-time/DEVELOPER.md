# Writing Time — developer notes

> Moved out of `README.md` so the marketplace listing stays purely
> user-facing. Everything below is for plugin authors reading the source.

## Permissions

`session` — reading today's writing time and totals.

---

## For plugin authors

Reference example for the **session lifecycle** — a live "time spent writing
today" counter, shown as a floating card, a tray chip, and a sheet.

```bash
# from the monorepo root
npm install
npm run build -w @pensiv-plugins/writing-time
node scripts/pack-plugin.mjs plugins/writing-time   # → writing-time.pnsv-plugin
```

### What it shows

- `session.activeMs()` — active writing time today.
- `session.on('write-start' | 'write-stop' | 'tick')` — the lifecycle stream.
- `session.today()` — word/character totals, for context.
- `registerWidget` with `component` + `chip` + `sheet` — one plugin, three
  surfaces, one shared state hook so they can never disagree.
- `formFactors` on a setting field — the "floating widget" toggle is hidden on
  phones, which use the tray chip instead.
- `ui.openSheet(node)` — hand the host a body and let it pick the surface: a
  dialog on desktop, a real bottom sheet on mobile.

### Daily goal

`targetMinutes` (default 60, `0` disables) turns the card into a progress view:
the goal row reads `1h · 70%` and a pill track underneath fills to that share —
the analytics `SegmentedBar` recipe, down to `--chart-1` as the fill and the
shared chart grow-in easing, so it animates from zero on mount and morphs on
every later change.

### Looking native

Three surfaces, three host recipes — none of them hand-invented:

- **Floating card** — the app's floating-widget chrome (`--popover` fill, the
  `--floating-ring` hairline + top highlight, `rounded-xl`, backdrop blur), a
  ghost cog button, the goal widgets' `label — value` rows and their 0.25rem
  progress track. Sized to match the Daily Goal widget (16rem, 0.875rem rows) —
  the two stack in the same corner, so a bigger card reads as a different
  design language. The live state is the app's `--label-green`, which has its
  own light and dark value. Lives in [`styles.css`](src/styles.css) as tokens,
  so it is theme- and text-size-correct.
- **Tray chip** — white + `mix-blend-mode: difference` over the host's pill, the
  same recipe as the native Timer and Daily Goal chips.
- **Phone sheet** — composed from `@pensiv/plugin-ui` (`SheetStack`,
  `SheetGroup`, `SheetStatRow`, `SheetActionRow`), i.e. the host's live sheet
  rows, so it matches every other plugin sheet with no layout CSS of its own.

Strings and the duration format are localized (en / ko / ja): `1h 24m`,
`1시간 24분`, `1時間24分`.

### What `activeMs` actually measures

Writing time, not app-open time. The host accumulates wall clock between
consecutive edits and drops any gap longer than its idle window, so stepping away
does not inflate the number. It is device-local (summing across devices would
double-count overlapping sessions) and resets at local midnight.

`tick` only fires during a writing stretch, which is what makes the live counter
cheap — no interval of your own, and nothing running while the user reads.
