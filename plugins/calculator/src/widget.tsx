import * as React from 'react';
import type { WidgetProps } from '@pensiv/plugin-sdk';
import { CalculatorPanel } from './panel';
import { formatDisplay } from './engine';
import { useCalculatorStore } from './store';
import { readSettings } from './settings';
import { localeTag } from './i18n';

/**
 * Floating widget. The host owns the floating chrome (drag, corner snap,
 * stacking) via `frame: 'floating'`; this renders only the card body, so it is
 * one more live view of the same {@link calculatorStore}. Buttons and inputs are
 * excluded from the drag handle by the host, so the display doubles as the grab
 * area without any of the keys becoming draggable.
 */
export const CalculatorFloatingWidget: React.FC<WidgetProps> = ({ app }) => (
  <div
    className="pnsv-calc-card-chrome"
    style={{
      width: '15rem',
      padding: '0.625rem',
      borderRadius: 'calc(var(--radius) + 0.35rem)',
      background: 'hsl(var(--popover) / 0.95)',
      color: 'hsl(var(--popover-foreground))',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      fontFamily: 'inherit'
    }}
  >
    <CalculatorPanel app={app} variant="card" />
  </div>
);

/**
 * Compact tray chip (phones). Returns *only the inner content* of the host's
 * pill — the live display value — while the host owns the pill chrome and the
 * tap that opens the sheet.
 */
export const CalculatorChip: React.FC<WidgetProps> = ({ app }) => {
  const store = useCalculatorStore();
  const settings = readSettings(app);

  return (
    <span className="pnsv-calc-chip">
      {store.state.memorySet ? <span className="pnsv-calc-chip-mem">M</span> : null}
      <span className="pnsv-calc-chip-value">
        {formatDisplay(store.state.entry, {
          group: settings.groupThousands,
          decimals: settings.decimals,
          locale: localeTag(app)
        })}
      </span>
    </span>
  );
};
