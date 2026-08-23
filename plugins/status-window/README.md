# Status Window

Character stat blocks for web novels — the `[ Status ]` panel your readers expect, written from typed values instead of retyped by hand every few chapters.

```
=====
이름: 성진우 | 레벨: 1
직업: 없음 | 피로도: 0
HP: 100 | MP: 10
근력: 10 | 체력: 10
=====
```

## Why

Serials in the game-fantasy, hunter, isekai and LitRPG lineages print a character's numbers into the prose, over and over, for hundreds of chapters. Done by hand that costs three things:

- the formatting stays consistent only through vigilance;
- the numbers have to be carried forward from the last time by memory;
- the growth line — `근력 : 14 [F] → 16(+2)[F]` — has to be assembled from two sheets that were never in the same place.

The usual answer is a spreadsheet in another window. The complaint about that is never that the spreadsheet is hard to build; it is that updating it means leaving the manuscript, and that it only ever knows the _current_ state, so **"what were her stats in chapter 31?"** has no answer.

This lives in the editor, and stores what changed per episode rather than a snapshot per episode. Both of those follow from the complaint.

## What it does

**Typed attributes.** Seven kinds, derived from real serials rather than invented:

| Kind     | Prints as                                 |
| -------- | ----------------------------------------- |
| Text     | `검신(신화)`                              |
| Number   | `64`                                      |
| Stat     | `415(+566)`, `298(+260 밸런스 한계치)[D]` |
| Resource | `70/70 재생 0.80/분`                      |
| Gauge    | `0% (0/4 에센스)`                         |
| Rank     | `노말`                                    |
| List     | `[인터페이스]` `[퀘스트 시스템]`          |

**Carry-forward and growth arrows.** A value typed in chapter 4 is still there in chapter 40. Change it and the block prints the arrow: `14 [F] → 16(+2)[F]`. Correct an early chapter and every later one follows, because no later chapter ever stored a copy.

**Six presets, each pre-filled — and all of them yours.** Not just a template string: separator, padding, column count, list punctuation and number grouping all differ by lineage, and each preset seeds its own attribute rows so you are not typing seventeen stat names before you see anything.

They ship as **starting content**, copied into your own storage the first time you open the plugin. From then on: rename, retune, duplicate, delete. A status window is a house style, and six transcriptions of other people's serials are a good place to start and a bad place to stop — your own convention is the one that has to be expressible. _Restore defaults_ copies the seed in again.

| Preset                 | Lineage                                       |
| ---------------------- | --------------------------------------------- |
| Korean · game fantasy  | 달빛조각사 — 17 fields, aligned two columns   |
| Korean · hunter        | 나 혼자만 레벨업 — pipe-separated two columns |
| Korean · growth serial | base(+bonus), grade suffixes, growth arrows   |
| Japanese · classic RPG | なろう Type 1 — fullwidth `：` and `　`       |
| Japanese · minimal     | なろう Type 2 — name alone, no stat readout   |
| LitRPG                 | STR/DEX/…, XP bar, comma-grouped thousands    |

**An attribute library, also editable.** "Add attribute" offers ready-made rows — `근력 (stat, F–SSS)`, `Experience (gauge, XP)` — rather than abstract types, so one click gives a row that is already named and configured. Delete the ones your genre never uses, and **Save to library** on any row you have built adds it. Blank rows of each of the seven kinds are still there underneath.

**System messages.** `레벨 업!` / `능력치 포인트 (1)` is its own thing — no character, no attributes. `/system message` opens a two-field composer.

**Column alignment that actually aligns.** Padding is computed in display columns, so `근력` counts as four and the colons line up. `String.padEnd` gets this wrong for every CJK sheet.

## Using it

1. Open a chapter and click the **Status window** button in the document header.
2. Pick a character — every sheet in the project is listed, and you can add one that lives only here.
3. Fill in the rows. The line beside each name is what the reader will see.
4. **Insert into text.**

Type `/status window` to insert for the last character without opening the pane.

## Live blocks

An inserted block is **plain text**. That is deliberate — it exists to be pasted into 네이버시리즈, 문피아, カクヨム or Royal Road, none of which know what an editor node is.

On top of that text the plugin leaves an invisible mark, which lets **Refresh status windows in this episode** rewrite blocks in place after you change a number. Turn the mark off in settings if you don't want it, and **Convert status windows to plain text** removes every one at any time.

Disabling the plugin also removes the marks — and leaves every status window exactly as written. Nothing is lost, and re-enabling finds them again.

## Settings

**Preferences**

- **Omit empty rows** — leave out attributes with no value. Zero still prints; `자유 스텟 : 0` is a real line.
- **Episode order** — whether stats carry through the current folder or the whole project.
- **Live status windows** / **Refresh blocks when stats change**.

**Presets** — the second tab. The preset list (add, duplicate, rename, delete, set as default), every convention option on the selected one — columns, name and value alignment, padding character, thousands grouping, list separator, growth arrow, regen wording, bar width — its template, a live preview, and the attribute library.

There is no third panel: presets are content, and content belongs in settings next to the list it edits.

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
