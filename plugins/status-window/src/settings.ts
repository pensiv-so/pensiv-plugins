/**
 * Preferences — the declarative half, plus the reader everything else uses.
 *
 * The schema is host-rendered: pensiv draws these controls with its own form
 * components, so the settings page looks like the settings page rather than like
 * a plugin's idea of one. Values land in `app.storage` under each field's `key`,
 * which is the same store {@link readSettings} reads — the form and the pane
 * cannot drift.
 */
import type { HostApi, SettingsSchema } from '@pensiv/plugin-sdk';
import type { BlockSettings } from './blocks';
import { DEFAULT_PRESET_ID, DEFAULT_SYSTEM_PRESET_ID } from './presets';
import { text } from './i18n';
import type { EpisodeScope } from './storage';

export const KEY_PRESET = 'preset';
export const KEY_SYSTEM_PRESET = 'systemPreset';
export const KEY_OMIT_EMPTY = 'omitEmpty';
export const KEY_LIVE_BLOCKS = 'liveBlocks';
export const KEY_SCOPE = 'scope';
export const KEY_AUTO_REFRESH = 'autoRefresh';
export const KEY_TEMPLATES = 'templates';

export const DEFAULTS = {
  preset: DEFAULT_PRESET_ID,
  systemPreset: DEFAULT_SYSTEM_PRESET_ID,
  omitEmpty: true,
  liveBlocks: true,
  scope: 'folder' as EpisodeScope,
  autoRefresh: false
};

/** Everything the render path needs, read in one go. */
export function readSettings(app: HostApi): BlockSettings {
  return {
    presetId: app.storage.get<string>(KEY_PRESET) ?? DEFAULTS.preset,
    omitEmpty: app.storage.get<boolean>(KEY_OMIT_EMPTY) ?? DEFAULTS.omitEmpty,
    liveBlocks: app.storage.get<boolean>(KEY_LIVE_BLOCKS) ?? DEFAULTS.liveBlocks,
    scope: app.storage.get<EpisodeScope>(KEY_SCOPE) ?? DEFAULTS.scope,
    templates: app.storage.get<Record<string, string>>(KEY_TEMPLATES) ?? {}
  };
}

export function readSystemPresetId(app: HostApi): string {
  return app.storage.get<string>(KEY_SYSTEM_PRESET) ?? DEFAULTS.systemPreset;
}

export function readAutoRefresh(app: HostApi): boolean {
  return app.storage.get<boolean>(KEY_AUTO_REFRESH) ?? DEFAULTS.autoRefresh;
}

/** Save one preset's edited template. An empty string restores the default. */
export function writeTemplate(app: HostApi, presetId: string, template: string): void {
  const templates = app.storage.get<Record<string, string>>(KEY_TEMPLATES) ?? {};
  const next = { ...templates };
  if (template.trim() === '') delete next[presetId];
  else next[presetId] = template;
  app.storage.set(KEY_TEMPLATES, next, { scope: 'synced' });
}

/**
 * The host-rendered preferences.
 *
 * Note what is *not* here: the preset picker. A schema's `select` options are
 * fixed when the plugin loads, and the preset list is the writer's to change at
 * any time — a preset added today wouldn't appear in a static select until the
 * next reload. Choosing the default lives in the preset editor tab, beside the
 * list it refers to.
 */
export const settingsSchema: SettingsSchema = {
  fields: [
    {
      key: KEY_OMIT_EMPTY,
      type: 'toggle',
      label: text.settingsOmitEmpty,
      description: text.settingsOmitEmptyHint,
      default: DEFAULTS.omitEmpty
    },
    {
      key: KEY_SCOPE,
      type: 'radio',
      label: text.settingsScope,
      description: text.settingsScopeHint,
      default: DEFAULTS.scope,
      options: [
        { value: 'folder', label: text.scopeFolder },
        { value: 'project', label: text.scopeProject }
      ]
    },
    {
      key: KEY_LIVE_BLOCKS,
      type: 'toggle',
      label: text.settingsLiveBlocks,
      description: text.settingsLiveBlocksHint,
      default: DEFAULTS.liveBlocks
    },
    {
      key: KEY_AUTO_REFRESH,
      type: 'toggle',
      label: text.settingsAutoRefresh,
      description: text.settingsAutoRefreshHint,
      default: DEFAULTS.autoRefresh,
      // Refreshing in place is only possible for blocks that carry the mark.
      visibleWhen: { key: KEY_LIVE_BLOCKS, equals: true }
    }
  ]
};
