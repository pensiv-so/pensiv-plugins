import type { UserConfig } from 'vite';

/** Modules the host provides at runtime; never bundled into a plugin. */
export declare const PLUGIN_EXTERNALS: readonly string[];

export interface DefinePluginConfigOptions {
  /** Entry module. Defaults to `src/main.ts`. */
  entry?: string;
  /** Extra externals to add on top of {@link PLUGIN_EXTERNALS}. */
  external?: string[];
}

/**
 * Shared vite library build for a Pensiv plugin. Produces the bundle shape the
 * app's runtime loader expects: a single ES module (`main.js`) plus an optional
 * `styles.css`, with `react`, `react-dom`, and `@pensiv/plugin-sdk` externalized.
 */
export declare function definePluginConfig(options?: DefinePluginConfigOptions): UserConfig;

export default definePluginConfig;
