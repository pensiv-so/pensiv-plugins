import * as React from 'react';
import type { HostApi } from '@pensiv/plugin-sdk';
import { toISO, type ShiftUnit } from './engine';
import { buildReadout } from './readout';
import { readSettings } from './settings';
import { dateStore, today, useDateStore } from './store';
import { DateField } from './datefield';
import { ModePicker } from './picker';
import { STR, tr } from './i18n';
import { Copy, Icon, InsertText, RotateCcw, Swap } from './icons';

/**
 * The date calculator body, shared by every surface: the file's side pane, the
 * floating card, and the phone sheet. One component, one store — the dates typed
 * in the pane are still there in the widget.
 *
 * `variant` only changes the metrics (`pane` gets its own insets, because plugin
 * panes are rendered full-bleed, and full-size fields, because it has the room).
 * Behaviour is identical everywhere, so the surfaces can't drift apart.
 */
export interface DatePanelProps {
  app: HostApi;
  variant?: 'card' | 'pane';
  /**
   * Omit the inline mode picker. The pane passes this because the host draws its
   * header and the picker lives there (`headerLeading`); the floating card and
   * the phone sheet have no such chrome, so they keep it inline.
   */
  hideMode?: boolean;
}

const SHIFT_UNITS: Array<{ id: ShiftUnit; label: keyof typeof STR }> = [
  { id: 'days', label: 'days' },
  { id: 'weeks', label: 'weeks' },
  { id: 'months', label: 'months' },
  { id: 'years', label: 'years' }
];

export const DatePanel: React.FC<DatePanelProps> = ({ app, variant = 'card', hideMode }) => {
  const store = useDateStore();
  const settings = readSettings(app);
  const now = today(app);

  // Blank fields are filled with today on mount rather than in the store's
  // constructor: "today" comes from the host clock, and a widget left open past
  // midnight should come back on the new day. `hydrate` also applies the
  // "open on" setting, but only once — after that the mode the user picked wins.
  React.useEffect(() => {
    dateStore.hydrate(today(app), readSettings(app).defaultMode);
  }, [app]);

  const state = store.state;
  const readout = buildReadout({
    app,
    settings,
    today: now,
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

  const outputText = (): string =>
    settings.insertFormat === 'summary' ? readout.insertSummary : readout.insertValue;

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

  const todayISO = toISO(now);
  /* The app's ghost icon button at `sizeVariant="sm"` — 2rem, the same target
   * every icon button in the app's own chrome uses. */
  const iconBtn = 'pnsv-dc-btn pnsv-dc-btn-ghost pnsv-dc-btn-icon';
  /** Shared by every date field in every mode. */
  const dateFieldProps = { app, format: settings.dateFormat, today: now };

  return (
    <div className={`pnsv-dc pnsv-dc-${variant}`}>
      {hideMode ? null : (
        <div className="pnsv-dc-pickrow">
          <ModePicker app={app} />
        </div>
      )}

      {state.mode === 'age' ? (
        <div className="pnsv-dc-fields">
          <DateField
            {...dateFieldProps}
            label={tr(app, STR.birthDate)}
            value={state.birth}
            onChange={(birth) => store.patch({ birth })}
            placeholder={tr(app, STR.pickDate)}
          />
          <DateField
            {...dateFieldProps}
            label={tr(app, STR.asOf)}
            value={state.reference}
            onChange={(reference) => store.patch({ reference })}
            onToday={() => store.patch({ reference: todayISO })}
            placeholder={tr(app, STR.pickDate)}
          />
        </div>
      ) : null}

      {state.mode === 'between' ? (
        <div className="pnsv-dc-fields">
          <DateField
            {...dateFieldProps}
            label={tr(app, STR.startDate)}
            value={state.from}
            onChange={(from) => store.patch({ from })}
            onToday={() => store.patch({ from: todayISO })}
            placeholder={tr(app, STR.pickDate)}
          />
          <DateField
            {...dateFieldProps}
            label={tr(app, STR.endDate)}
            value={state.to}
            onChange={(to) => store.patch({ to })}
            onToday={() => store.patch({ to: todayISO })}
            placeholder={tr(app, STR.pickDate)}
          />
          <button
            type="button"
            className={`${iconBtn} pnsv-dc-swap`}
            aria-label={tr(app, STR.swap)}
            title={tr(app, STR.swap)}
            onClick={() => store.patch({ from: state.to, to: state.from })}
          >
            <Icon size="1rem">{Swap}</Icon>
          </button>
        </div>
      ) : null}

      {state.mode === 'shift' ? (
        <div className="pnsv-dc-fields">
          <DateField
            {...dateFieldProps}
            label={tr(app, STR.baseDate)}
            value={state.shiftBase}
            onChange={(shiftBase) => store.patch({ shiftBase })}
            onToday={() => store.patch({ shiftBase: todayISO })}
            placeholder={tr(app, STR.pickDate)}
          />
          <div className="pnsv-dc-field">
            <span className="pnsv-dc-field-head">
              <span className="pnsv-dc-label">{tr(app, STR.amount)}</span>
            </span>
            <div className="pnsv-dc-shift">
              <div className="pnsv-dc-sign">
                <button
                  type="button"
                  className={`pnsv-dc-btn pnsv-dc-sign-btn ${
                    state.shiftSign === 1 ? 'pnsv-dc-btn-selected' : 'pnsv-dc-btn-ghost'
                  }`}
                  aria-pressed={state.shiftSign === 1}
                  aria-label={tr(app, STR.add)}
                  onClick={() => store.patch({ shiftSign: 1 })}
                >
                  +
                </button>
                <button
                  type="button"
                  className={`pnsv-dc-btn pnsv-dc-sign-btn ${
                    state.shiftSign === -1 ? 'pnsv-dc-btn-selected' : 'pnsv-dc-btn-ghost'
                  }`}
                  aria-pressed={state.shiftSign === -1}
                  aria-label={tr(app, STR.subtract)}
                  onClick={() => store.patch({ shiftSign: -1 })}
                >
                  −
                </button>
              </div>
              <input
                type="number"
                className="pnsv-dc-input pnsv-dc-number"
                value={state.shiftAmount}
                min={0}
                aria-label={tr(app, STR.amount)}
                onChange={(event) =>
                  store.patch({ shiftAmount: Math.max(0, Number(event.target.value) || 0) })
                }
              />
              <select
                className="pnsv-dc-input pnsv-dc-select"
                value={state.shiftUnit}
                aria-label={tr(app, STR.amount)}
                onChange={(event) => store.patch({ shiftUnit: event.target.value as ShiftUnit })}
              >
                {SHIFT_UNITS.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {tr(app, STR[unit.label])}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

      {/* No answer yet → nothing at all. An empty box asking for the date the
          user is already typing into is chrome that only ever states the
          obvious; a real conflict still gets its one line below. */}
      {!readout.ready ? (
        readout.note ? (
          <p className="pnsv-dc-note">{readout.note}</p>
        ) : null
      ) : (
        <div className="pnsv-dc-result">
          <div className="pnsv-dc-headline-row">
            <div>
              <div className="pnsv-dc-headline">{readout.headline}</div>
              {readout.caption ? <div className="pnsv-dc-caption">{readout.caption}</div> : null}
            </div>
            <div className="pnsv-dc-actions">
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
              <button
                type="button"
                className={iconBtn}
                aria-label={tr(app, STR.reset)}
                title={tr(app, STR.reset)}
                onClick={() => store.reset(now)}
              >
                <Icon size="1rem">{RotateCcw}</Icon>
              </button>
            </div>
          </div>
          <dl className="pnsv-dc-rows">
            {readout.rows.map((row) => (
              <div key={row.label} className="pnsv-dc-row" title={row.note}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
};
