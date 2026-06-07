import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests live next to what they cover, in each package/plugin's `test/`.
    include: [
      'packages/**/test/**/*.test.ts',
      'plugins/**/test/**/*.test.ts',
      'scripts/**/*.test.mjs'
    ],
    // Node by default; DOM-dependent suites opt in with
    // `// @vitest-environment jsdom` at the top of the file (e.g. the timer store).
    environment: 'node'
  }
});
