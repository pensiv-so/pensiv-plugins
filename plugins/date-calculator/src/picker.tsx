import * as React from 'react';
import type { HostApi } from '@pensiv/plugin-sdk';
import { useDateStore, type Mode } from './store';
import { STR, tr } from './i18n';
import { ChevronDown, Icon } from './icons';

const MODES: Array<{ id: Mode; label: keyof typeof STR }> = [
  { id: 'age', label: 'age' },
  { id: 'between', label: 'between' },
  { id: 'shift', label: 'shift' }
];

/**
 * The mode selector: a dropdown, not a tab strip.
 *
 * Three tabs across the top of a narrow pane spent its widest row on navigation
 * and scrolled with the body. As a dropdown it costs one control, and in the
 * pane it sits beside the title in the header (`headerLeading`) — the same place
 * the built-in panes put their own switches — so the body is nothing but the
 * dates and the answer.
 *
 * The visible control is the app's ghost button; the real `<select>` lies
 * transparently over it, so the menu is the platform's (keyboard, type-ahead, no
 * custom popup to trap focus) while the button is ours — the trick the app's
 * calendar caption uses for its year dropdown.
 */
export const ModePicker: React.FC<{ app: HostApi }> = ({ app }) => {
  const store = useDateStore();
  const current = MODES.find((mode) => mode.id === store.state.mode) ?? MODES[0]!;

  return (
    <span className="pnsv-dc-pick">
      <span className="pnsv-dc-pick-label">{tr(app, STR[current.label])}</span>
      <Icon size="0.875rem" className="pnsv-dc-pick-chevron">
        {ChevronDown}
      </Icon>
      <select
        className="pnsv-dc-pick-select"
        value={store.state.mode}
        aria-label={tr(app, STR.title)}
        onChange={(event) => store.patch({ mode: event.target.value as Mode })}
      >
        {MODES.map((mode) => (
          <option key={mode.id} value={mode.id}>
            {tr(app, STR[mode.label])}
          </option>
        ))}
      </select>
    </span>
  );
};
