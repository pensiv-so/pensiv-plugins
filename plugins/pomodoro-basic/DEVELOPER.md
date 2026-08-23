# Pomodoro Basic — developer notes

> Moved out of `README.md` so the marketplace listing stays purely
> user-facing. Everything below is for plugin authors reading the source.

## How it works

- **One store, every surface.** A module-level singleton (`src/store.ts`) owns the
  run-state; the header, widget, chip and sheet all subscribe to it, so starting in
  one updates the rest instantly.
- **Wall-clock countdown.** A running phase records the epoch it ends at and
  recomputes the remainder on every tick, so a backgrounded (throttled) renderer
  can't make a 25-minute block drift. A phase that expired while the app was closed
  only completes if it expired in the last five minutes.
- **The dial is CSS, not SVG.** 60 tick marks come from one repeating conic
  gradient masked to a ring, and the elapsed arc is the same pattern intersected
  with a conic wedge — no 60 elements to lay out, and the same rule scales from the
  12rem sheet dial down to the 0.9rem header ring.
- **The phase colour is only ever an accent.** Lit ticks, the badge and the header
  ring take it; the card itself stays on the app's neutral popover, hairline ring
  and ghost buttons. The badge is the app's MCP-settings status pill.
- **Icons are lucide**, inlined at the app's `MonoIcon` weight (stroke 1.5) — the
  marketplace build only allows relative imports plus the host modules, so the
  package can't be a dependency.

## Permissions

- `notifications` — the end-of-phase system notification (declining it leaves the chime and the UI).
