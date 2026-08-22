import * as React from 'react';
import type { WidgetProps } from '@pensiv/plugin-sdk';
import { ConverterPanel } from './panel';
import { readSettings } from './settings';
import { useConverterStore } from './store';
import { categoryById, convert, formatValue, resolvePair, unitsOf } from './units';
import { localeTag } from './i18n';

/**
 * Floating widget. The host owns the floating chrome (drag, corner snap,
 * stacking) via `frame: 'floating'`; this renders only the card body, so it is
 * one more live view of the same {@link converterStore}. Buttons, inputs and
 * selects are excluded from the drag handle by the host, so the card can be
 * grabbed anywhere else without the controls becoming draggable.
 */
export const ConverterFloatingWidget: React.FC<WidgetProps> = ({ app }) => (
  <div
    className="pnsv-uc-card-chrome"
    style={{
      width: '15.5rem',
      padding: '0.75rem',
      borderRadius: 'calc(var(--radius) + 0.35rem)',
      background: 'hsl(var(--popover) / 0.95)',
      color: 'hsl(var(--popover-foreground))',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      fontFamily: 'inherit'
    }}
  >
    <ConverterPanel app={app} variant="card" />
  </div>
);

/**
 * Compact tray chip (phones). Returns *only the inner content* of the host's
 * pill — the converted value and its unit — while the host owns the pill chrome
 * and the tap that opens the sheet.
 */
export const ConverterChip: React.FC<WidgetProps> = ({ app }) => {
  const store = useConverterStore();
  const settings = readSettings(app);

  const category = categoryById(store.state.category);
  const available = unitsOf(category, settings.includeHistorical);
  // The same resolution the panel runs, from the same module — a chip showing a
  // different pair from the sheet it opens would be a bug, not a shortcut.
  const { from, to } = resolvePair(category, store.pairFor(category.id), available);
  const result = convert(Number.parseFloat(store.state.value), from, to);

  return (
    <span className="pnsv-uc-chip">
      <span className="pnsv-uc-chip-value">
        {result === null ? '—' : formatValue(result, settings.precision, localeTag(app))}
      </span>
      <span className="pnsv-uc-chip-unit">{to.symbol}</span>
    </span>
  );
};
