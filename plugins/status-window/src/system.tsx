/**
 * The system message composer.
 *
 * `레벨 업!` / `능력치 포인트 (1)` is not a status window — no character, no
 * attributes, no carry-forward. It is a handful of lines in a frame, and writers
 * reach for it far more often than for the full sheet. So it gets its own tiny
 * surface: a textarea, a live preview, and insert.
 *
 * It shows up **inside the side pane**, as a mode of the same panel the header
 * toggle opens — one surface for the plugin, not a modal that covers the prose
 * the writer is composing against. `SystemMessageSheet` keeps the old host-sheet
 * wrapper for hosts too old to open a pane view programmatically.
 */
import * as React from 'react';
import type { HostApi } from '@pensiv/plugin-sdk';
import { insertText } from './blocks';
import { createT } from './i18n';
import { renderSystemBlock } from './render';
import { getSystemPreset, listSystemPresets } from './library';
import { KEY_SYSTEM_PRESET, readSystemPresetId } from './settings';

/** The composer itself, with no surface chrome — the pane supplies its own. */
export const SystemMessageBody: React.FC<{ app: HostApi; onDone: () => void }> = ({
  app,
  onDone
}) => {
  const t = React.useMemo(() => createT(app), [app]);
  const [raw, setRaw] = React.useState('');
  const [presetId, setPresetId] = React.useState(() => readSystemPresetId(app));
  const systemPresets = React.useMemo(() => listSystemPresets(app), [app]);

  const lines = raw.split('\n');
  const preview = renderSystemBlock(getSystemPreset(app, presetId), lines);

  return (
    <>
      <div className="pnsv-sw-chips">
        {systemPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="pnsv-sw-chip"
            data-active={preset.id === presetId ? 'true' : undefined}
            onClick={() => {
              setPresetId(preset.id);
              // Remember the choice — a serial uses one convention throughout.
              app.storage.set(KEY_SYSTEM_PRESET, preset.id, { scope: 'synced' });
            }}
          >
            {typeof preset.name === 'string' ? preset.name : (preset.name[app.app.locale] ?? preset.id)}
          </button>
        ))}
      </div>

      <textarea
        className="pnsv-sw-input pnsv-sw-textarea"
        autoFocus
        rows={5}
        value={raw}
        placeholder={t('systemLinesPlaceholder')}
        onChange={(event) => setRaw(event.target.value)}
      />

      <pre className="pnsv-sw-preview">{preview.text || '—'}</pre>

      <div className="pnsv-sw-foot">
        <button
          type="button"
          className="pnsv-sw-button"
          data-variant="primary"
          disabled={preview.text.trim() === ''}
          onClick={() => {
            app.ui.toast(insertText(app, preview.text) ? t('inserted') : t('cannotInsertHere'));
            onDone();
          }}
        >
          {t('insert')}
        </button>
      </div>
    </>
  );
};

/** Host-sheet wrapper — the fallback path on hosts without `ui.openPaneView`. */
export const SystemMessageSheet: React.FC<{ app: HostApi; onDone: () => void }> = (props) => (
  <div className="pnsv-sw" data-variant="sheet">
    <SystemMessageBody {...props} />
  </div>
);
