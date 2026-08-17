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

// 1.1.0 — new capabilities, not a fix: `app.session.history()`,
// `registerAnalyticsSection`, and the text-anchoring set (`SurfaceTarget.range`,
// the `editor.selection` surface, `app.project.content()`, `app.ui.openFile()`,
// arguments on `editor.runCommand()`) — which together let a plugin anchor its
// own data to a span of prose, list those anchors across the manuscript, and
// navigate back to one. Minor, per semver, since all of it is additive —
// existing `sdk: "^1.0.0"` plugins keep running untouched.
export const HOST_API_VERSION = '1.1.0';

/** Runtime helper so plugins resolve their own {@link LocalizedText} strings. */
export { resolveLocalizedText } from './types';

export { Plugin } from './plugin';
export type { PluginCommand, SettingTab, RegisteredEditorExtension } from './plugin';
export type { WidgetContribution, WidgetProps } from './widget';
export type {
  ContributionDisposer,
  ActionContext,
  HeaderFileTypeId,
  PluginViewMode,
  SurfaceScope,
  EditorSurfaceId,
  EditorExtensionOptions,
  HeaderActionContribution,
  AppHeaderActionContribution,
  AppHeaderActionProps,
  PaneViewContribution,
  PaneViewProps,
  PaneContribution,
  PaneProps,
  SidebarItemContribution,
  SidebarItemProps,
  SlashItemContribution,
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
  PluginSurfaceId,
  SurfaceTargetType,
  SurfaceTarget,
  SurfaceItemContext,
  SurfaceItemProps,
  SurfaceItemContribution
} from './surfaces';
export type {
  AnalyticsSectionContribution,
  AnalyticsSectionContext,
  AnalyticsSectionData,
  AnalyticsStat,
  AnalyticsRow,
  AnalyticsPoint,
  AnalyticsChart,
  AnalyticsColor
} from './analytics';
export type {
  CanvasNodeState,
  CanvasNodeViewProps,
  CanvasNodeContribution
} from './canvas-node';
export type {
  PluginGraphNode,
  PluginGraphLink,
  GraphSourceContext,
  GraphFilterNode,
  GraphSourceContribution,
  GraphFilterContribution
} from './graph';
export type {
  HostApi,
  EditorApi,
  CountOptions,
  ProjectApi,
  ProjectFile,
  ProjectFileContent,
  ProjectFileType,
  ProjectEntityType,
  ProjectPlotCard,
  ProjectPlotPartCard,
  ProjectRelationship,
  ProjectQuery,
  ProjectFilePatch,
  ProjectFileDraft,
  ProjectLinkDraft,
  ProjectChangeKind,
  SessionApi,
  SessionProgress,
  SessionTotals,
  SessionHistoryDay,
  StorageApi,
  StorageOptions,
  UiApi,
  OpenFileOptions,
  OpenSheetOptions,
  ClipboardApi,
  PlatformApi,
  AppApi,
  PaneApi,
  PaneSelectionItem,
  EditorRange,
  Unsub
} from './host-api';

// Re-export the serializable data model so authors get everything from one place.
export type {
  PluginManifest,
  PluginIcon,
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
