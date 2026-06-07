/**
 * Shared vite library build for a Pensiv plugin.
 *
 * Produces the bundle shape the app's runtime loader expects: a single ES module
 * (`main.js`) whose `default` export is the plugin's `Plugin` subclass, plus an
 * optional `styles.css`. `react`, `react-dom`, and `@pensiv/plugin-sdk` are
 * marked **external** — the host provides them at load time (via import-map /
 * globals) so every plugin shares one React and one SDK and ships tiny.
 *
 * Usage in a plugin's `vite.config.ts`:
 *
 *   import { definePluginConfig } from '@pensiv/build-config';
 *   export default definePluginConfig();
 */

/** Modules the host provides at runtime; never bundled into a plugin. */
export const PLUGIN_EXTERNALS = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  '@pensiv/plugin-sdk',
  '@pensiv/plugin-ui',
  '@tiptap/core'
];

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
        external: [...PLUGIN_EXTERNALS, ...external],
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
