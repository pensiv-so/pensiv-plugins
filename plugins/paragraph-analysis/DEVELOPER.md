# Paragraph Analysis — developer notes

> Moved out of `README.md` so the marketplace listing stays purely
> user-facing. Everything below is for plugin authors reading the source.

## Permissions

- `editor.read` — reading the open document's structure
- `project.read` — the project scope and the analytics card
- `clipboard` — the copy-summary command only

---

## For plugin authors

Reference example for a **read-only analysis plugin**: walking ProseMirror JSON,
a debounced live pane, a declarative settings form that feeds a pure engine, and
an analytics card that reuses the same numbers.

```bash
# from the monorepo root
npm install
npm run build -w @pensiv-plugins/paragraph-analysis
node scripts/pack-plugin.mjs plugins/paragraph-analysis   # → paragraph-analysis.pnsv-plugin
```

### What it shows

- `editor.getDoc()` — **not** `editor.getText()`. Text joins blocks with a
  separator, so an empty paragraph and a paragraph break become the same two
  newlines and the empty-paragraph count is unrecoverable. The doc walk keeps
  them, recurses through blockquotes and lists, and skips code blocks.
- `editor.on('update')` behind a 400 ms trailing debounce — a manuscript-sized
  walk is cheap but not free, and running it in the keystroke path is how a stats
  pane turns into typing lag.
- `project.query({ type: ['document', 'sheet'] })` + `project.content(id).doc` —
  the same walker over the whole manuscript, with `project.subscribe` keeping it
  live.
- `addSettingTab({ schema })` — a `select` per glyph family, with `sample` chips
  showing the actual marks. The engine takes the mapping as an argument, so the
  form has no logic in it.
- `registerAnalyticsSection` — the project mix as host-drawn stats and rows, using
  `--chart-1..4` palette slots that match the pane's own segments.

### Design — take the substance, leave the chrome

The pane reuses the analytics page's **substance** verbatim: the stat type scale
(muted `text-sm` label, `text-lg tracking-tight` figure, `text-xs` hint), the
chart palette slots, the 100%-stacked bar and its legend, and the grow-in /
count-up easing (`cubic-bezier(0.22, 1, 0.36, 1)`).

What it doesn't reuse is the card chrome. That page nests bordered cards inside
tinted trays because it has a settings-width column to fill; at 344px the same
nesting is a box inside a box, and the borders end up louder than the figures. So
the tray is gone, the tiles carry a fill instead of a border, and the chart sits
directly on the pane. The tabs are underlined rather than a pill for the same
reason — with no cards to float above, a pill is the heaviest object on screen.

The host's `useChartGrowIn` and `RollingNumber` live behind `motion/react`, which
is not a module a plugin may import, so [`motion.ts`](src/motion.ts) restates the
same curve, the same durations and the same reduced-motion rule. Change one and
change the other.

### Where the logic lives

[`analyze.ts`](src/analyze.ts) is pure — no host, no React — so the classifier
is testable on its own and arguable in one file. Everything else is a view of what
it decides: [`pane.tsx`](src/pane.tsx) draws it, [`settings.ts`](src/settings.ts)
configures it, [`main.tsx`](src/main.tsx) wires the four surfaces, and
[`test/analyze.test.ts`](test/analyze.test.ts) pins down the three-script
behaviour including the traps above.
