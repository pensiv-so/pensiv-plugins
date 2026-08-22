import * as React from 'react';
import type { HostApi } from '@pensiv/plugin-sdk';
import {
  formatDisplay,
  keyFromEvent,
  OPERATOR_SYMBOL,
  type CalcKey,
  type Operator
} from './engine';
import { useCalculatorStore } from './store';
import { readSettings } from './settings';
import { localeTag, STR, tr } from './i18n';
import { Backspace, Copy, History, Icon, InsertText, Trash } from './icons';

/**
 * The calculator body, shared by every surface: the file's side pane, the
 * floating card, and the phone sheet. One component, one store — a sum started
 * in the pane is finished in the widget.
 *
 * `variant` only changes the metrics (`pane` gets its own insets, because plugin
 * panes are rendered full-bleed). Layout, behaviour and keyboard handling are
 * identical everywhere, so the surfaces can't drift apart.
 */
export interface CalculatorPanelProps {
  app: HostApi;
  variant?: 'card' | 'pane';
}

type KeySpec = {
  /** What the key prints. Operators print their symbol. */
  label: string;
  key: CalcKey;
  /** Which of the app's button variants this key wears. */
  tone: 'digit' | 'operator' | 'utility' | 'equals';
  /** Accessible name where the glyph alone is not one. */
  aria?: string;
};

/** Map a key's role to the app's `Button` variant class, so keys *are* buttons. */
const TONE_VARIANT: Record<KeySpec['tone'], string> = {
  digit: 'pnsv-calc-btn-muted',
  operator: 'pnsv-calc-btn-ghost pnsv-calc-key-operator',
  utility: 'pnsv-calc-btn-ghost pnsv-calc-key-utility',
  equals: 'pnsv-calc-btn-solid pnsv-calc-key-equals'
};

const op = (value: Operator): KeySpec => ({
  label: OPERATOR_SYMBOL[value],
  key: { type: 'operator', value },
  tone: 'operator'
});

const digit = (value: string): KeySpec => ({
  label: value,
  key: { type: 'digit', value },
  tone: 'digit'
});

const MEMORY_KEYS: Array<{ label: string; value: 'clear' | 'recall' | 'add' | 'sub' | 'store' }> = [
  { label: 'MC', value: 'clear' },
  { label: 'MR', value: 'recall' },
  { label: 'M+', value: 'add' },
  { label: 'M−', value: 'sub' },
  { label: 'MS', value: 'store' }
];

export const CalculatorPanel: React.FC<CalculatorPanelProps> = ({ app, variant = 'card' }) => {
  const store = useCalculatorStore();
  const settings = readSettings(app);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // The pane is a deliberate "I want the calculator now" gesture, so it takes the
  // keyboard when it opens. The floating card does not: it is ambient, and
  // stealing focus from the manuscript to a widget nobody just asked for is the
  // one thing an always-on-screen surface must never do.
  React.useEffect(() => {
    if (variant === 'pane') rootRef.current?.focus({ preventScroll: true });
  }, [variant]);

  const shown = formatDisplay(store.state.entry, {
    group: settings.groupThousands,
    decimals: settings.decimals,
    locale: localeTag(app)
  });

  const keys: KeySpec[] = [
    { label: 'C', key: { type: 'clear' }, tone: 'utility', aria: tr(app, STR.clear) },
    { label: 'CE', key: { type: 'clearEntry' }, tone: 'utility', aria: tr(app, STR.clearEntry) },
    { label: '%', key: { type: 'percent' }, tone: 'utility', aria: tr(app, STR.percent) },
    op('div'),
    digit('7'),
    digit('8'),
    digit('9'),
    op('mul'),
    digit('4'),
    digit('5'),
    digit('6'),
    op('sub'),
    digit('1'),
    digit('2'),
    digit('3'),
    op('add'),
    { label: '±', key: { type: 'negate' }, tone: 'utility', aria: tr(app, STR.negate) },
    digit('0'),
    { label: '.', key: { type: 'decimal' }, tone: 'digit', aria: tr(app, STR.decimal) },
    { label: '=', key: { type: 'equals' }, tone: 'equals', aria: tr(app, STR.equals) }
  ];

  /**
   * The keyboard is bound to the panel, never to the window: a global listener
   * would eat digits the user is typing into their manuscript. Focus the
   * calculator (the pane does it on open) and it takes keys; click away and it
   * stops.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const key = keyFromEvent(event);
    if (!key) return;
    event.preventDefault();
    store.press(key);
  };

  /** The text the copy / insert actions produce, per the insert settings. */
  const outputText = (): string => {
    const value = formatDisplay(store.state.entry, {
      group: settings.insertGrouped,
      decimals: settings.decimals,
      locale: localeTag(app)
    });
    if (settings.insertFormat === 'expression' && store.state.trail.endsWith('=')) {
      return `${store.state.trail} ${value}`;
    }
    return value;
  };

  const copy = (): void => {
    app.platform.clipboard
      .writeText(outputText())
      .then(() => app.ui.toast(tr(app, STR.copied)))
      .catch(() => app.ui.toast(tr(app, STR.copyFailed)));
  };

  const insert = (): void => {
    try {
      app.editor.insert(outputText());
      app.ui.toast(tr(app, STR.inserted));
    } catch {
      // No editor focused, or the grant was declined — either way the useful
      // message is "open something you can type in", not a stack trace.
      app.ui.toast(tr(app, STR.insertFailed));
    }
  };

  const keyHeight = variant === 'card' ? '2.25rem' : '2.75rem';

  return (
    <div
      ref={rootRef}
      className={`pnsv-calc pnsv-calc-${variant}`}
      tabIndex={0}
      role="application"
      aria-label={tr(app, STR.calculator)}
      onKeyDown={onKeyDown}
    >
      {settings.showTape && store.tape.length > 0 ? (
        <div className="pnsv-calc-tape">
          <div className="pnsv-calc-tape-head">
            <span className="pnsv-calc-tape-title">
              <Icon size="0.75rem">{History}</Icon>
              {tr(app, STR.tape)}
            </span>
            <button
              type="button"
              className="pnsv-calc-btn pnsv-calc-btn-ghost pnsv-calc-btn-icon"
              aria-label={tr(app, STR.clearTape)}
              title={tr(app, STR.clearTape)}
              onClick={() => store.clearTape()}
            >
              <Icon size="0.9375rem">{Trash}</Icon>
            </button>
          </div>
          <div className="pnsv-calc-tape-rows">
            {store.tape.map((entry, index) => (
              <button
                type="button"
                key={`${entry.expression}-${index}`}
                className="pnsv-calc-btn pnsv-calc-btn-ghost pnsv-calc-tape-row"
                onClick={() => store.recall(entry)}
              >
                <span className="pnsv-calc-tape-expr">{entry.expression}</span>
                <span className="pnsv-calc-tape-result">
                  {formatDisplay(entry.result, {
                    group: settings.groupThousands,
                    decimals: settings.decimals,
                    locale: localeTag(app)
                  })}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="pnsv-calc-display">
        <div className="pnsv-calc-trail">
          {store.state.memorySet ? <span className="pnsv-calc-mem">M</span> : null}
          <span className="pnsv-calc-trail-text">{store.state.trail}</span>
        </div>
        <div className="pnsv-calc-value" aria-live="polite">
          {shown}
        </div>
        <div className="pnsv-calc-display-actions">
          <button
            type="button"
            className="pnsv-calc-btn pnsv-calc-btn-ghost pnsv-calc-btn-icon"
            aria-label={tr(app, STR.copy)}
            title={tr(app, STR.copy)}
            onClick={copy}
          >
            <Icon size="1rem">{Copy}</Icon>
          </button>
          <button
            type="button"
            className="pnsv-calc-btn pnsv-calc-btn-ghost pnsv-calc-btn-icon"
            aria-label={tr(app, STR.insert)}
            title={tr(app, STR.insert)}
            onClick={insert}
          >
            <Icon size="1rem">{InsertText}</Icon>
          </button>
          <button
            type="button"
            className="pnsv-calc-btn pnsv-calc-btn-ghost pnsv-calc-btn-icon"
            aria-label={tr(app, STR.backspace)}
            title={tr(app, STR.backspace)}
            onClick={() => store.press({ type: 'backspace' })}
          >
            <Icon size="1rem">{Backspace}</Icon>
          </button>
        </div>
      </div>

      <div className="pnsv-calc-memory">
        {MEMORY_KEYS.map((memory) => (
          <button
            type="button"
            key={memory.value}
            className="pnsv-calc-btn pnsv-calc-btn-ghost pnsv-calc-btn-xs"
            disabled={
              (memory.value === 'recall' || memory.value === 'clear') && !store.state.memorySet
            }
            onClick={() => store.press({ type: 'memory', value: memory.value })}
          >
            {memory.label}
          </button>
        ))}
      </div>

      <div className="pnsv-calc-pad" style={{ gridAutoRows: keyHeight }}>
        {keys.map((spec) => (
          <button
            type="button"
            key={spec.label + spec.key.type}
            className={`pnsv-calc-btn pnsv-calc-key ${TONE_VARIANT[spec.tone]}`}
            aria-label={spec.aria}
            onClick={() => store.press(spec.key)}
          >
            {spec.label}
          </button>
        ))}
      </div>
    </div>
  );
};
