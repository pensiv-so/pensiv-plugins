# Calculator — developer notes

> Moved out of `README.md` so the marketplace listing stays purely
> user-facing. Everything below is for plugin authors reading the source.

## How it works

- **A pure state machine.** [`src/engine.ts`](src/engine.ts) is the calculator:
  keys in, state out, no React and no host API. Every surface, every keystroke and
  the command all go through `applyKey`, which is why the whole of
  [`test/engine.test.ts`](test/engine.test.ts) can test it by pressing keys.
- **One store, every surface.** A module-level singleton
  ([`src/store.ts`](src/store.ts)) holds the live state, and persists _itself_ to a
  `localStorage` key — a half-typed sum is on-device run-state, not a setting worth
  syncing to your phone. Durable preferences live in `app.storage` via the settings
  schema.
- **A pane, not a dialog.** `registerPaneView` docks the calculator beside the
  editor. Arithmetic happens _while_ you are writing — word counts, ages, page
  budgets — and a modal takes away the manuscript you are doing the arithmetic
  about, then closes the moment you touch the text again. Docking is also what
  makes "insert result" worth having: the caret is still where you left it.
- **Every file type, on purpose.** The pane view is registered with no
  `fileTypes` filter. `SurfaceScope` is omit-to-allow, so the toggle appears in
  every file type — including ones pensiv adds later, with no republish.
- **The controls are the app's controls.** [`src/styles.css`](src/styles.css) ports
  `Button` (variants, sizes, `active:scale-[0.98]`, the focus ring) and reads the
  host's tokens, so the keys follow the user's theme and accent. Digits are the
  `muted` variant, corrections are `ghost`, and `=` is the same gradient primary
  button the rest of the app uses.
- **The keyboard is panel-scoped.** Key handling is bound to the panel, never to
  the window: a global listener would swallow digits meant for the manuscript.

## Permissions

- `editor.write` — only for the insert button.
- `clipboard` — only for the copy button.

Neither is touched unless you press the corresponding button.
