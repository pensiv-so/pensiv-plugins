# Date Calculator

Ages, spans and date arithmetic — docked in the side pane of every file type, and
as an optional floating widget. Built for the questions a manuscript asks: how old
is she in this scene, how long between these two chapters, what day of the week
was that.

## Features

- **Age** — completed years (만 나이) with the exact years / months / days, days
  lived, the weekday you were born on, and a countdown to the next birthday
- **Korean counting age** (세는 나이) and the year age (연 나이), each toggleable
- **Between** two dates — total days, the calendar breakdown, weeks + days, and
  the weekday of each end; optionally counting the end date
- **Add / subtract** days, weeks, months or years from any date, with the
  resulting weekday and how far it is from today
- **Copy** or **insert** the result into the open document or sheet
- Commands: `Insert today's date`, `Toggle floating widget`
- Four surfaces from one state: side pane, floating widget, phone tray chip, bottom sheet

## Usage

Enable the plugin and a calendar toggle appears in the header of every file —
document, sheet, plotboard, canvas, folder view or task. Click it and the
calculator docks in that file's side pane, beside the editor: pick a mode, type
the dates, and they stay on screen while you write.

Prefer it floating over the text? Settings → Date Calculator → **Show floating
widget**, or run the toggle command. Both surfaces share one set of dates.

Date format, which ages are shown, and whether a span counts its end date all
live in the same settings tab.

## How it works

- **Civil dates, not `Date` objects.** [`src/engine.ts`](src/engine.ts) works on a
  plain `{ year, month, day }` triple and integer day numbers (Howard Hinnant's
  `days_from_civil`). `new Date('2026-02-29')` silently rolls to March, daylight
  saving makes "add one day" occasionally add 23 hours, and a birthday has no time
  zone at all — a character born on 29 February must stay born on 29 February in
  every renderer on Earth.
- **Differences round-trip.** `diffYMD` walks whole months forward with the same
  clamping `addMonths` uses, so `from + diff === to` always holds and the "between"
  and "add / subtract" modes can never contradict each other.
- **29 February resolves to 1 March** in common years, the convention Korean and
  Japanese civil practice share — and the only one that keeps a birthday countdown
  from skipping three years in four.
- **One store, every surface.** A module-level singleton
  ([`src/store.ts`](src/store.ts)) holds the dates and persists _itself_ to a
  `localStorage` key; durable preferences live in `app.storage` via the settings
  schema. Blank fields are filled with today on mount, from the host clock, so a
  widget left open past midnight comes back on the new day.
- **A pane, not a dialog.** `registerPaneView` docks the calculator beside the
  editor. You work out a character's age _against_ the scene you are writing, and
  a modal hides the scene.
- **Every file type, on purpose.** The pane view is registered with no
  `fileTypes` filter — `SurfaceScope` is omit-to-allow, so the toggle appears in
  every file type, including ones pensiv adds later, with no republish.
- **The controls are the app's controls.** [`src/styles.css`](src/styles.css) ports
  `Button`, `Input` and `Tabs` from the app (same variants, sizes, focus ring) and
  reads the host tokens, so the mode switch and the date fields are the app's own,
  on the user's theme and accent.

## Permissions

- `editor.write` — only for the insert button and the insert-today command.
- `clipboard` — only for the copy button.
