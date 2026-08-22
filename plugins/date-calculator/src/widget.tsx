import * as React from 'react';
import type { WidgetProps } from '@pensiv/plugin-sdk';
import { DatePanel } from './panel';
import { buildReadout } from './readout';
import { readSettings } from './settings';
import { today, useDateStore } from './store';

/**
 * Floating widget. The host owns the floating chrome (drag, corner snap,
 * stacking) via `frame: 'floating'`; this renders only the card body, so it is
 * one more live view of the same {@link dateStore}. Buttons and inputs are
 * excluded from the drag handle by the host, so the card can be grabbed anywhere
 * else without the date fields becoming draggable.
 */
export const DateFloatingWidget: React.FC<WidgetProps> = ({ app }) => (
  <div
    className="pnsv-dc-card-chrome"
    style={{
      width: '16rem',
      padding: '0.75rem',
      borderRadius: 'calc(var(--radius) + 0.35rem)',
      background: 'hsl(var(--popover) / 0.95)',
      color: 'hsl(var(--popover-foreground))',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      fontFamily: 'inherit'
    }}
  >
    <DatePanel app={app} variant="card" />
  </div>
);

/**
 * Compact tray chip (phones). Returns *only the inner content* of the host's
 * pill — the current headline (the age, the span, the resulting date) — while the
 * host owns the pill chrome and the tap that opens the sheet.
 */
export const DateChip: React.FC<WidgetProps> = ({ app }) => {
  const store = useDateStore();
  const state = store.state;
  const readout = buildReadout({
    app,
    settings: readSettings(app),
    today: today(app),
    mode: state.mode,
    birth: state.birth,
    reference: state.reference,
    from: state.from,
    to: state.to,
    shiftBase: state.shiftBase,
    shiftAmount: state.shiftAmount,
    shiftUnit: state.shiftUnit,
    shiftSign: state.shiftSign
  });

  return (
    <span className="pnsv-dc-chip">
      <span className="pnsv-dc-chip-value">{readout.headline}</span>
    </span>
  );
};
