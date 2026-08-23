# Writing Time

Live active-writing time as a floating widget, tray chip and sheet.

## Features

- A floating card showing how long you have actually been writing today, counting up as you type
- Green "writing now" state while you write, dimmed while you pause
- Optional daily time goal with a progress bar and percentage
- A tray chip on phones and a summary sheet from the command palette
- A **Writing time** section in Settings → Analytics: total, per-writing-day average,
  best day and a per-day bar chart, following the page's own range selector
- Korean, Japanese and English

## Usage

Enable the plugin — the floating card appears in the corner and can be dragged
or hidden from its settings. Set a **daily time goal** there to get the progress
bar (`0` turns it off).

The counter measures _writing_ time, not app-open time: gaps longer than the
idle window are dropped, it is per-device, and it resets at local midnight.
