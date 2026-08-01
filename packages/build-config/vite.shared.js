/**
 * Shared vite library build for a pensiv plugin.
 *
 * Produces the bundle shape the app's runtime loader expects: a single ES module
 * (`main.js`) whose `default` export is the plugin's `Plugin` subclass, plus an
 * optional `styles.css`. `react`, `react-dom`, `@pensiv/plugin-sdk`,
 * `@tiptap/core` and `@tiptap/pm/*` are marked **external** — the host provides
 * them at load time (via import-map / globals) so every plugin shares one React,
 * one SDK and one ProseMirror, and ships tiny. Sharing ProseMirror is mandatory:
 * see {@link PLUGIN_EXTERNALS}.
 *
 * Usage in a plugin's `vite.config.ts`:
 *
 *   import { definePluginConfig } from '@pensiv/build-config';
 *   export default definePluginConfig();
 */

/**
 * Modules the host provides at runtime; never bundled into a plugin.
 *
 * `@tiptap/pm/*` is not a size optimisation — it is a correctness requirement.
 * ProseMirror identifies objects with `instanceof`, so a plugin that bundles its
 * own copy hands the host classes it does not recognise. The concrete failure:
 * a bundled `DecorationSet` fails `instanceof DecorationSet` inside the host's
 * `DecorationGroup.from`, which flattens sources with
 * `concat(m instanceof DecorationSet ? m : m.members)` — a foreign set has no
 * `.members`, so `undefined` lands in the group and every later redraw throws
 * "Cannot read properties of undefined (reading 'localsInner')". The editor is
 * then dead for the rest of the session. Same for `Node`/`Schema` (model),
 * `Plugin`/`Selection` (state) and `Step` (transform).
 *
 * Mirrors `RUNTIME_MODULES` in pensiv-app (`shared/app/plugins/bundle-loader.ts`)
 * and `PLUGIN_EXTERNALS` in pensiv-core (`services/pluginPack.service.ts`).
 */
export const PLUGIN_EXTERNALS = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  '@pensiv/plugin-sdk',
  '@pensiv/plugin-ui',
  '@tiptap/core',
  '@tiptap/pm/state',
  '@tiptap/pm/view',
  '@tiptap/pm/model',
  '@tiptap/pm/transform',
  '@tiptap/pm/commands',
  '@tiptap/pm/keymap',
  '@tiptap/pm/history',
  '@tiptap/pm/inputrules'
];

/**
 * Catch-all so a `@tiptap/pm/*` submodule that is not listed above (or a direct
 * `prosemirror-*` import) is still left external instead of being silently
 * bundled as a second ProseMirror instance. Anything matching this that the host
 * does not actually provide fails loudly at load time — which is the outcome we
 * want, rather than a poisoned editor.
 */
export const PLUGIN_EXTERNAL_PATTERNS = [/^@tiptap\/pm\//, /^prosemirror-/];

/**
 * @param {object} [options]
 * @param {string} [options.entry] Entry module. Defaults to `src/main.ts`.
 * @param {string[]} [options.external] Extra externals to add.
 * @returns {import('vite').UserConfig}
 */
export function definePluginConfig(options = {}) {
  const { entry = 'src/main.ts', external = [] } = options;
  return {
    // Automatic JSX runtime → bundle imports `react/jsx-runtime` (kept external
    // and provided by the host), so plugins never bundle or assume a global React.
    esbuild: { jsx: 'automatic' },
    build: {
      lib: {
        entry,
        formats: ['es'],
        fileName: () => 'main.js'
      },
      rollupOptions: {
        external: [...PLUGIN_EXTERNALS, ...PLUGIN_EXTERNAL_PATTERNS, ...external],
        output: {
          // Emit a stable `styles.css` next to `main.js`.
          assetFileNames: (asset) =>
            asset.name && asset.name.endsWith('.css') ? 'styles.css' : '[name][extname]'
        }
      },
      cssCodeSplit: false,
      minify: 'esbuild',
      // Broad-webview floor: downlevel es2020+ syntax (optional chaining, class
      // fields, …) so bundles PARSE on old Android System WebView (<84) and iOS
      // <15. The runtime loader's import-map fallback only fixes import
      // resolution, not syntax — es2022 output would SyntaxError there before it
      // ran. Core plugins use no es2020+ runtime APIs, and React/SDK are external,
      // so the size cost is negligible. ES-module format is kept (formats:['es']);
      // the binding floor is dynamic `import()` support (Chrome 63 / iOS 11).
      target: 'es2017',
      emptyOutDir: true
    }
  };
}

export default definePluginConfig;
