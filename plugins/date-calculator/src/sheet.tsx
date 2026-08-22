import * as React from 'react';
import type { WidgetProps } from '@pensiv/plugin-sdk';
import { SheetActionRow, SheetGroup, SheetStack } from '@pensiv/plugin-ui';
import { DatePanel } from './panel';
import { Icon, Settings } from './icons';
import { STR, tr } from './i18n';

/**
 * The phone bottom-sheet body, opened by tapping the widget-tray chip. That
 * sheet is the host's own tray behaviour, not a dialog this plugin chose: on a
 * phone there is no room to dock a pane beside the editor.
 *
 * Wrapped in the host UI kit (`@pensiv/plugin-ui`) so it matches every other
 * plugin sheet, with the same panel inside as the pane and the floating card.
 */
export const DateSheet: React.FC<WidgetProps> = ({ app }) => (
  <SheetStack>
    <SheetGroup style={{ padding: '0.75rem' }}>
      <DatePanel app={app} variant="pane" />
    </SheetGroup>
    <SheetGroup>
      <SheetActionRow
        icon={<Icon size="1.15rem">{Settings}</Icon>}
        label={tr(app, STR.settings)}
        onClick={() => app.ui.openSettings()}
      />
    </SheetGroup>
  </SheetStack>
);
