import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Flat config for the public authoring kit. Intentionally light: the goal is a
 * consistent, correct corpus of example plugins, not a maximal rule set that
 * fights external contributors. Type-aware rules are off (fast, no project
 * service) — `npm run typecheck` is the type gate.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.pnsv-plugin',
      'packages/plugin-sdk/dist/**',
      // @pensiv/plugin-sdk/src is mirror-generated from the pensiv app — it is
      // linted at its source of truth, not here (see README "SDK source of truth").
      'packages/plugin-sdk/src/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      // Plugins legitimately bridge to the dynamically-typed host boundary.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  }
);
