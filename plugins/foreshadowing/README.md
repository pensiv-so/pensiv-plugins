# Foreshadowing

Mark a sentence as foreshadowing, mark where it pays off, and see what you still owe the reader.

## Features

- Select a sentence → **Plant foreshadowing** from the floating toolbar (or the right-click menu)
- Write down **how you mean to pay it off**: planting asks for a note while the plan is
  still in your head, and it stays on the row — and on the sentence, as a tooltip — until
  it lands
- Select the sentence where it lands → **Pay off foreshadowing** opens a picker of the
  open beats; choose one and the payoff is anchored
- Every beat in one list — open first, paid-off struck through — in the
  **document side pane** and on the plugin's own **settings page**
- Click a row to jump straight to the sentence — in any document, not just the open one
- The checkbox toggles both ways: tick a beat off by hand when it pays off off-page, or
  untick a paid-off one to put it back on the open list (the marks stay in the text)
- A payoff-rate card in Settings → Analytics, with the files still carrying open beats
- Korean, Japanese and English

## Usage

Open a document, select the sentence that plants the seed, and press the bookmark button
in the toolbar that appears over the selection. The sentence gets a dotted
underline and shows up in the **Foreshadowing** list.

A note opens with it — "how do you mean to pay this off?" — because the plan is only
reliably in your head at that moment. Write it, or press Escape and carry on; you can add
or change it later from the note button on any row. Notes show under the beat in the list,
in the payoff picker (which is how you tell two similar beats apart), and as a tooltip on
the sentence itself. Turn the prompt off in Settings → Preferences if you plant faster
than you plan.

Next to the prose, the side pane toggle in the document header shows the list —
manuscript-wide by default, with a **This file** tab for narrowing. The plugin's
settings page carries the same list for when no document is open.

Later — same document or twenty chapters on — select the sentence where the beat
lands and press **Pay off foreshadowing** in the same toolbar: a picker shows the
sentence you selected and the beats still open, and choosing one anchors the
payoff. The row moves to paid-off and the rate at the top goes up — and unticking
it later puts the beat back on the open list without touching the text.

The marks live **inside the document**, so they move as you rewrite, sync to your
other devices with the text, and show up in version history. Delete the sentence
and the beat goes with it.

---

## For plugin authors

Reference example for **anchoring plugin data to prose**.

```bash
# from the monorepo root
npm install
npm run build -w @pensiv-plugins/foreshadowing
node scripts/pack-plugin.mjs plugins/foreshadowing   # → foreshadowing.pnsv-plugin
```

### The mark _is_ the database

The obvious design — a table of `{ fileId, from, to }` rows in `app.storage` — is
wrong, and expensively so: those offsets are stale the moment the writer types a
word above them, and the plugin never sees the edit. [`mark.ts`](src/mark.ts)
stores each beat as a TipTap mark instead, so the app's own machinery does the
work: the anchor moves with the text, syncs on the document's path, lands in
version history, and dies with the sentence it marked.

Copied from the host's inline-comment mark: `inclusive: false` (typing at an edge
doesn't extend the beat), `excludes: ''` (beats may overlap), `keepOnSplit: true`
(Enter inside a beat doesn't destroy it).

Only two things stay in `app.storage` — the manual tick and the preferences — and
[`store.ts`](src/store.ts) argues why each one can't be a mark. The note went the other
way for the same reason the anchor did: it belongs to the sentence, so it should survive a
cut-and-pasted paragraph and die with a deleted one. (`app.storage` is _user_ settings, not
project data, which is a second trap — a `gid → text` map there is one project switch away
from being pruned against the wrong project.)

### Writing to a file that isn't on screen

`app.editor` is **the editor the user is looking at**, so a mark in another file cannot be
patched where it stands — `runCommand` returns `false`. Editing a note from the list
therefore opens the beat's file and writes once the host has it, retrying until the command
lands and reporting failure if it never does ([`note.tsx`](src/note.tsx)). Pay that cost
explicitly; a fire-and-forget `runCommand` would silently drop what the user typed.

### Use `target.range`, not `getSelection()`

Both editor surfaces hand the item a `target.range` snapshotted **when the surface
opened**:

```ts
this.registerSurfaceItem({
  surface: 'editor.selection', // the floating toolbar — phones and tablets too
  id: 'plant',
  label: 'Plant foreshadowing',
  icon: 'Bookmark',
  when: (ctx) => !!ctx.target?.range,
  onClick: (ctx) => {
    const id = crypto.randomUUID();
    this.app.editor.runCommand(
      'setForeshadowAnchor',
      { fid: id, gid: id, kind: 'setup', label: '' },
      ctx.target!.range // ← what the user highlighted
    );
  }
});
```

Calling `app.editor.getSelection()` inside `onClick` reads the selection _after_
the menu took focus or the tap moved the caret, which is how a beat ends up
anchored to the wrong words. Register the same item on `editor.menu` for the
desktop right-click path — `editor.selection` is the one that exists on touch.

`runCommand(name, ...args)` is how a plugin drives a command its own editor
extension registered, with data the selection can't carry.

### Reading the whole manuscript

`app.project.content(id)` returns `{ doc, text }` for any document or sheet in the
open project — the only way to see text outside the file being edited, and what
the rate is computed from. `doc` is cloned on first access, so a scan that only
needs `text` costs nothing. [`scan.ts`](src/scan.ts) reads the _active_ file from
the editor instead, because project data lags it by the debounced save.

`app.ui.openFile(fileId, { range })` is the way back: it opens the file in the
split view and scrolls to the span once that editor has loaded, whether the file
was already open or not.

### Files

| File                           | What it holds                                                         |
| ------------------------------ | --------------------------------------------------------------------- |
| [`mark.ts`](src/mark.ts)       | the TipTap mark + its commands (the anchor layer)                     |
| [`anchors.ts`](src/anchors.ts) | pure walkers: ProseMirror JSON → beats → threads → stats              |
| [`scan.ts`](src/scan.ts)       | project-wide scan over `app.project.content()`                        |
| [`note.tsx`](src/note.tsx)     | the note sheet + the write path into a possibly-inactive file         |
| [`store.ts`](src/store.ts)     | the manual tick and preferences in `app.storage`                      |
| [`list.tsx`](src/list.tsx)     | one list component: project tab, side pane, settings page             |
| [`main.tsx`](src/main.tsx)     | registration: extension, surfaces, pane, command, analytics, settings |

`anchors.ts` is where the position arithmetic lives and is unit-tested
([`test/anchors.test.ts`](test/anchors.test.ts)) — `getText()` offsets are **not**
ProseMirror positions, and the difference only shows up past the first paragraph.
