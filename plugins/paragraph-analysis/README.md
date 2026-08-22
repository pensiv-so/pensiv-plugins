# Paragraph Analysis

A panel that keeps counting beside your manuscript: how many paragraphs and
characters go to narration, dialogue, monologue and special dialogue, how long
the average paragraph runs, and how many lines one takes on a phone.

![The paragraph mix of the open file](https://raw.githubusercontent.com/pensiv-so/pensiv-plugins/main/plugins/paragraph-analysis/screenshots/04-pane-en.png)

## How a paragraph is classified

Only the first character matters. A double quote opens dialogue; a single quote
or a parenthesis opens monologue; brackets, white corner brackets and angle
brackets open special dialogue; everything else is narration. The rule keys off
the glyph rather than your UI language, so a `「」` inside a Korean manuscript and
a straight quote inside an English one both read correctly.

| Bucket               | Opens with                                                  |
| -------------------- | ----------------------------------------------------------- |
| **Dialogue**         | `“ ”` `" "` `「 」` `« »`                                   |
| **Monologue**        | `‘ ’` `' '` `( )` `（ ）`                                   |
| **Special dialogue** | `[ ]` `［ ］` `【 】` `〔 〕` `〈 〉` `《 》` `『 』` `{ }` |
| **Narration**        | everything else                                             |
| _(empty)_            | nothing but whitespace — counted, never bucketed            |

A speech tag after the line doesn't change it: `"Not bad," he said.` is dialogue.
A quote in the middle of a sentence doesn't create one. An opener with no closer
stays narration rather than becoming a guess, and an apostrophe is never read as
a closing quote, so `'Tis the season` stays narration too. Indentation is
stripped first, the full-width space (U+3000) included, so a manuscript pasted in
from somewhere else still reads correctly.

The defaults follow what Korean, English-language and Japanese manuscripts
actually use, and every ambiguous family is remappable in settings — some writers
put system messages in parentheses, some reserve `『 』` for titles.

A narration-heavy English manuscript is not a bug. English inner voice is carried
by italics, which leaves no trace in plain text, so no glyph rule can find it.

## Empty paragraphs are counted separately

Blank-lining between paragraphs halves the average paragraph length. This plugin
counts empty paragraphs on their own and leaves them out of the average, so the
figure on screen is what you actually wrote.

The rest of the counting is tuned for manuscripts too:

- Characters are code points, so an emoji or a rare CJK ideograph counts once.
- A Shift+Enter line break is its own paragraph by default — writers who never
  press Enter would otherwise show one 4,000-character "paragraph".
- Headings are left out entirely; a chapter title is not prose.
- The mobile estimate averages `ceil(length ÷ column width)` per paragraph, so a
  one-character paragraph never rounds down to zero lines. The column defaults to
  28 characters (Korean / Japanese); English wants about 45.

## Also

- Tabs for this file and the whole project
- A project-wide mix card in Settings → Analytics
- Settings for the glyph rules, how characters are counted, and the mobile column
- Copy the summary to the clipboard from the command palette
- Korean, English and Japanese

## Usage

Enable the plugin, then open **Paragraph Analysis** from a document's header. The
numbers follow your typing, and the tabs at the top switch between this file and
the whole project.

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
