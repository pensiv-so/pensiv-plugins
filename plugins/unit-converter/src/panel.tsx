import * as React from 'react';
import type { HostApi } from '@pensiv/plugin-sdk';
import { categoryById, convert, formatValue, resolvePair, unitsOf } from './units';
import { readSettings } from './settings';
import { useConverterStore } from './store';
import { CategoryPicker } from './category';
import { localeTag, STR, tr } from './i18n';
import { Copy, Icon, InsertText, Swap } from './icons';

/**
 * The converter body, shared by every surface: the file's side pane, the
 * floating card, and the phone sheet. One component, one store — the pair of
 * units picked in one is what the others show.
 *
 * `variant` only changes the metrics (`pane` gets its own insets, because plugin
 * panes are rendered full-bleed). Behaviour is identical everywhere, so the
 * surfaces can't drift apart.
 */
export interface ConverterPanelProps {
  app: HostApi;
  variant?: 'card' | 'pane';
  /**
   * Omit the inline category picker. The pane passes this because the host draws
   * its header for it and the picker lives there (`headerActions`); the floating
   * card and the phone sheet have no such chrome, so they keep it inline.
   */
  hideCategory?: boolean;
}

export const ConverterPanel: React.FC<ConverterPanelProps> = ({
  app,
  variant = 'card',
  hideCategory
}) => {
  const store = useConverterStore();
  const settings = readSettings(app);
  const locale = localeTag(app);

  const category = categoryById(store.state.category);
  const available = unitsOf(category, settings.includeHistorical);
  const { from, to } = resolvePair(category, store.pairFor(category.id), available);

  const raw = Number.parseFloat(store.state.value);
  const result = convert(raw, from, to);
  const resultText = result === null ? '—' : formatValue(result, settings.precision, locale);

  /** The reference line: what one unit of the source is, in the target. */
  const unitRate = convert(1, from, to);
  const rateText =
    unitRate === null || from.toBase
      ? null
      : `1 ${from.symbol} = ${formatValue(unitRate, settings.precision, locale)} ${to.symbol}`;

  const outputText = (): string => {
    if (result === null) return '';
    switch (settings.insertFormat) {
      case 'number':
        return resultText;
      case 'both':
        return `${formatValue(raw, settings.precision, locale)} ${from.symbol} = ${resultText} ${to.symbol}`;
      default:
        return `${resultText} ${to.symbol}`;
    }
  };

  const copy = (): void => {
    const text = outputText();
    if (!text) return;
    app.platform.clipboard
      .writeText(text)
      .then(() => app.ui.toast(tr(app, STR.copied)))
      .catch(() => app.ui.toast(tr(app, STR.copyFailed)));
  };

  const insert = (): void => {
    const text = outputText();
    if (!text) return;
    try {
      app.editor.insert(text);
      app.ui.toast(tr(app, STR.inserted));
    } catch {
      // No editor focused, or the grant was declined — the useful message is
      // "open something you can type in", not a stack trace.
      app.ui.toast(tr(app, STR.insertFailed));
    }
  };

  const swap = (): void => {
    store.setPair(category.id, { from: to.id, to: from.id });
    // Carry the number across with the units: swapping is how you check a
    // conversion, and retyping the value defeats the point.
    if (result !== null) store.setValue(String(Number(result.toFixed(settings.precision + 2))));
  };

  /** The app's ghost icon button, at the size the display corners use. */
  const iconBtn = 'pnsv-uc-btn pnsv-uc-btn-ghost pnsv-uc-btn-icon';

  const unitOptions = (): React.ReactNode =>
    available.map((unit) => (
      <option key={unit.id} value={unit.id}>
        {unit.symbol} · {tr(app, unit.name)}
      </option>
    ));

  return (
    <div className={`pnsv-uc pnsv-uc-${variant}`}>
      {hideCategory ? null : (
        <div className="pnsv-uc-catrow">
          <CategoryPicker app={app} />
        </div>
      )}

      <div className="pnsv-uc-rows">
        <div className="pnsv-uc-row">
          <span className="pnsv-uc-side">{tr(app, STR.from)}</span>
          <input
            type="text"
            inputMode="decimal"
            className="pnsv-uc-input"
            value={store.state.value}
            aria-label={tr(app, STR.from)}
            onChange={(event) => store.setValue(event.target.value.replace(/[^\d.\-+e]/gi, ''))}
          />
          <select
            className="pnsv-uc-select"
            value={from.id}
            aria-label={`${tr(app, STR.from)} — ${tr(app, STR.category)}`}
            onChange={(event) =>
              store.setPair(category.id, { from: event.target.value, to: to.id })
            }
          >
            {unitOptions()}
          </select>
        </div>

        <button
          type="button"
          className={`${iconBtn} pnsv-uc-swap`}
          aria-label={tr(app, STR.swap)}
          title={tr(app, STR.swap)}
          onClick={swap}
        >
          <Icon size="1rem">{Swap}</Icon>
        </button>

        <div className="pnsv-uc-row">
          <span className="pnsv-uc-side">{tr(app, STR.to)}</span>
          <output className="pnsv-uc-output" aria-live="polite">
            {resultText}
          </output>
          <select
            className="pnsv-uc-select"
            value={to.id}
            aria-label={`${tr(app, STR.to)} — ${tr(app, STR.category)}`}
            onChange={(event) =>
              store.setPair(category.id, { from: from.id, to: event.target.value })
            }
          >
            {unitOptions()}
          </select>
        </div>
      </div>

      <div className="pnsv-uc-foot">
        <span className="pnsv-uc-rate">{result === null ? tr(app, STR.enterValue) : rateText}</span>
        <span className="pnsv-uc-actions">
          <button
            type="button"
            className={iconBtn}
            aria-label={tr(app, STR.copy)}
            title={tr(app, STR.copy)}
            onClick={copy}
          >
            <Icon size="1rem">{Copy}</Icon>
          </button>
          <button
            type="button"
            className={iconBtn}
            aria-label={tr(app, STR.insert)}
            title={tr(app, STR.insert)}
            onClick={insert}
          >
            <Icon size="1rem">{InsertText}</Icon>
          </button>
        </span>
      </div>
    </div>
  );
};
