/**
 * Plugin data model (v1) — the serializable contract.
 *
 * MIRROR: generated from the Pensiv app's `src/shared/app/types/plugin.ts`.
 * Do not hand-edit beyond the mirror — change the contract in the app repo
 * (where the host adapter implementing it lives) and re-mirror.
 *
 * Framework-agnostic: no React / TipTap types, so it is safe everywhere.
 * Anything a host stores for a plugin must stay shaped like this (serializable).
 */

/** Where a floating/pane/sheet widget is allowed to mount. `any` = host decides. */
/** Localizable text: a string, or a `{ lang: string }` map (e.g. `{ en, ko }`). */
export type LocalizedText = string | Record<string, string>;

/** Resolve {@link LocalizedText} to a language: exact → base lang → en → first. */
export function resolveLocalizedText(text: LocalizedText | undefined, lang = 'en'): string {
  if (text === undefined || text === null) return '';
  if (typeof text === 'string') return text;
  const base = lang.split('-')[0] ?? lang;
  return text[lang] ?? text[base] ?? text.en ?? Object.values(text)[0] ?? '';
}

export type WidgetSurface = 'floating' | 'pane' | 'sheet' | 'any';

/** Screen corner a floating widget snaps to. */
export type WidgetCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Capabilities a plugin may request. Declared in the manifest, granted by the
 * user at install (browser-extension style). `net:<host>` is a template-literal
 * member, e.g. `net:api.example.com`. Pure-utility plugins declare `[]`.
 */
export type PluginPermission =
  | 'editor.read'
  | 'editor.write'
  | 'editor.intercept'
  | 'project.read'
  | 'project.write'
  | 'session'
  | 'storage.synced'
  | 'clipboard'
  | 'notifications'
  | `net:${string}`;

/**
 * Provenance of an installed plugin. There is no `builtin` source: even
 * first-party plugins are authored here and *installed* through the same
 * pipeline as third-party ones.
 */
export type PluginSource = 'user' | 'shared' | 'marketplace';

/** Trust tier assigned by the host/catalog at install (not author-declared). */
export type PluginTier = 'verified' | 'reviewed' | 'unreviewed';

export interface PluginAuthor {
  name: string;
  url?: string;
}

/** Serializable description of one widget contribution (runtime component attached via the SDK). */
export interface WidgetManifestEntry {
  id: string;
  surface: WidgetSurface;
  defaultCorner?: WidgetCorner;
  storageKey?: string;
}

export interface CommandManifestEntry {
  id: string;
  name: string;
}

export interface SlashManifestEntry {
  id: string;
  title: string;
  icon?: string;
}

/** Serializable contribution surface declared in the manifest. */
export interface PluginContributions {
  widgets?: WidgetManifestEntry[];
  commands?: CommandManifestEntry[];
  slash?: SlashManifestEntry[];
  /** Opaque settings schema; rendered by the host. Typed via `SettingsSchema`. */
  settings?: { schema: unknown };
}

export interface PluginManifest {
  /** Reverse-DNS, required. First-party plugins use the `so.pensiv.*` namespace. */
  id: string;
  /** Display name. String, or a `{ lang: string }` map for localization. */
  name: LocalizedText;
  /** semver. */
  version: string;
  description?: LocalizedText;
  author?: PluginAuthor;
  /** MonoIcon name shown in the Plugins manage UI. */
  icon?: string;
  /** Host API semver range the plugin was authored against, e.g. "^1.0.0". */
  sdk: string;
  source: PluginSource;
  permissions: PluginPermission[];
  contributes: PluginContributions;
  minAppVersion?: string;
  /** Surfaces supported. Code plugins are desktop/web only (Apple §2.5.2). */
  platforms?: Array<'desktop' | 'mobile' | 'web'>;
  homepage?: string;
  license?: string;
}

/** Locator for a plugin's on-device code bundle (bytes never live in synced settings). */
export interface PluginBundleRef {
  format: 'esm';
  entry?: string;
  styles?: string;
  hash?: string;
}

/** A normalized, ready-to-install plugin. */
export interface NormalizedPlugin {
  manifest: PluginManifest;
  source: PluginSource;
  tier?: PluginTier;
  installedAt: string;
  warnings?: string[];
}

/** Per-plugin state a host persists (JSON-serializable). */
export interface InstalledPluginEntry {
  enabled: boolean;
  source?: PluginSource;
  tier?: PluginTier;
  plugin?: NormalizedPlugin;
  bundle?: PluginBundleRef;
  grants?: PluginPermission[];
  settings?: Record<string, unknown>;
  installedAt?: string;
}
