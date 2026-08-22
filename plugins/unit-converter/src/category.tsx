import * as React from 'react';
import type { HostApi } from '@pensiv/plugin-sdk';
import { CATEGORIES, categoryById, type CategoryId } from './units';
import { useConverterStore } from './store';
import { STR, tr } from './i18n';
import { ChevronDown, Icon } from './icons';

/**
 * The category picker: a compact dropdown, not a tab strip.
 *
 * Seven categories in a scrolling row spent the widest line of a narrow pane on
 * navigation, and scrolled away with the body. As a dropdown it costs one
 * control, and in the pane it lives in the *header* — `registerPaneView`'s
 * `headerActions` slot — where the host already draws the title row, so the
 * converter's own body is nothing but the conversion.
 *
 * The visible control is the app's ghost button; the menu is a real `<select>`
 * laid transparently over it, so the list is the platform's (keyboard, type-
 * ahead, no custom popup to trap focus) while the button is ours. The same trick
 * the app's calendar caption uses for its year dropdown.
 */
export const CategoryPicker: React.FC<{ app: HostApi }> = ({ app }) => {
  const store = useConverterStore();
  const category = categoryById(store.state.category);

  return (
    <span className="pnsv-uc-catpick">
      <span className="pnsv-uc-catpick-label">{tr(app, category.name)}</span>
      <Icon size="0.875rem" className="pnsv-uc-catpick-chevron">
        {ChevronDown}
      </Icon>
      <select
        className="pnsv-uc-catpick-select"
        value={category.id}
        aria-label={tr(app, STR.category)}
        onChange={(event) => store.setCategory(event.target.value as CategoryId)}
      >
        {CATEGORIES.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {tr(app, entry.name)}
          </option>
        ))}
      </select>
    </span>
  );
};
