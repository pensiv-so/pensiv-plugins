---
'@pensiv/plugin-sdk': minor
---

Additive host API surface that had accumulated since 1.1.0 was published:

- `ui.openPaneView(viewId)` — open a registered pane view from a command or a
  surface item. Optional, so a plugin can feature-detect it and fall back to
  `ui.openSheet` on an older shell.
- `session.activeMs(options)` / `session.countToday(options)` now take
  `DayWindowOptions` (`dayStartHour`), so a writer whose day starts at 4am gets
  totals that match how they actually work.
- `PaneViewProps` gains `headerLeading` / `headerActions` for panes that need
  their own header controls.
- `ProjectFile` gains `sheetCategory` and `portraitUrl`, so a plugin can draw a
  sheet with the same glyph the file tree uses.

This is a version-correctness release as much as a feature one: the registry's
1.1.0 was cut before these landed, so the published tarball and the tag of the
same name no longer matched.
