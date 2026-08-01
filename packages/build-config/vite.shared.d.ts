import type { UserConfig } from 'vite';

/**
 * Modules the host provides at runtime; never bundled into a plugin. Includes
 * `@tiptap/pm/*`: a second ProseMirror copy breaks the host's `instanceof`
 * checks and poisons the editor's decoration group.
 */
export declare const PLUGIN_EXTERNALS: readonly string[];

/** Catch-all patterns keeping any other `@tiptap/pm/*` / `prosemirror-*` id external. */
export declare const PLUGIN_EXTERNAL_PATTERNS: readonly RegExp[];

export interface DefinePluginConfigOptions {
  /** Entry module. Defaults to `src/main.ts`. */
  entry?: string;
  /** Extra externals to add on top of {@link PLUGIN_EXTERNALS}. */
  external?: string[];
}

/**
 * Shared vite library build for a pensiv plugin. Produces the bundle shape the
 * app's runtime loader expects: a single ES module (`main.js`) plus an optional
 * `styles.css`, with `react`, `react-dom`, and `@pensiv/plugin-sdk` externalized.
 */
export declare function definePluginConfig(options?: DefinePluginConfigOptions): UserConfig;

export default definePluginConfig;
