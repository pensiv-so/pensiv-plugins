---
'@pensiv/plugin-sdk': minor
---

`SessionTotals` gains an optional `basis` (`SessionBasis`): the local writing
`day` the totals cover (shifted by `dayStartHour`) and an opaque `source` that
changes when the totals are rebuilt rather than written to (another account,
another day window, or the cross-device baseline arriving late). A goal widget
can key "once a day" on `day` and take a fresh baseline when `source` changes,
so a rebuild never looks like the goal being reached. Absent on older hosts.
