/**
 * `@pensiv/plugin-sdk` — the public, fully-typed contract a Pensiv plugin is
 * authored against. One import surface: the {@link Plugin} base class, the typed
 * {@link HostApi}, the widget/contribution shapes, and the serializable data
 * model re-exported from `./types`.
 *
 * **Source of truth.** This module *is* the contract, living beside the host
 * adapter that implements it. In-app code imports it via
 * `@/shared/app/plugins/sdk`. For external authors it is published as the
 * `@pensiv/plugin-sdk` npm package, mirrored from here on release (so the
 * published `.d.ts` can never drift from the running implementation). The shape
 * below is the frozen v1 contract — see `HOST_API_VERSION`.
 */

export const HOST_API_VERSION = '1.0.0';

/** Runtime helper so plugins resolve their own {@link LocalizedText} strings. */
export { resolveLocalizedText } from './types';

export { Plugin } from './plugin';
export type { PluginCommand, SettingTab } from './plugin';
export type { WidgetContribution, WidgetProps } from './widget';
export type {
  ContributionDisposer,
  ActionContext,
  HeaderFileTypeId,
  HeaderActionContribution,
  AppHeaderActionContribution,
  AppHeaderActionProps,
  PaneViewContribution,
  PaneViewProps,
  PaneContribution,
  PaneProps,
  SidebarItemContribution,
  SidebarItemProps,
  SettingField,
  SettingItem,
  SettingGroup,
  SettingDivider,
  SettingHeader,
  SettingOption,
  LocalizedText,
  ObjectListColumn,
  FieldCondition,
  FieldConditions,
  PluginFormFactor,
  SettingsSchema
} from './contributions';
export type {
  HostApi,
  EditorApi,
  CountOptions,
  ProjectApi,
  SessionApi,
  SessionProgress,
  SessionTotals,
  StorageApi,
  StorageOptions,
  UiApi,
  ClipboardApi,
  PlatformApi,
  AppApi,
  EditorRange,
  Unsub
} from './host-api';

// Re-export the serializable data model so authors get everything from one place.
export type {
  PluginManifest,
  PluginAuthor,
  PluginPermission,
  PluginSource,
  PluginTier,
  PluginBundleRef,
  PluginContributions,
  WidgetManifestEntry,
  CommandManifestEntry,
  SlashManifestEntry,
  WidgetSurface,
  WidgetCorner,
  InstalledPluginEntry,
  NormalizedPlugin
} from './types';
