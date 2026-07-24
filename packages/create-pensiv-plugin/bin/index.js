#!/usr/bin/env node
/**
 * create-pensiv-plugin — scaffold a new pensiv plugin.
 *
 *   npm init pensiv-plugin my-plugin
 *   node packages/create-pensiv-plugin/bin/index.js my-plugin [--id=com.you.my-plugin]
 *
 * Inside the pensiv-plugins monorepo it clones `plugins/sample-plugin`
 * (the canonical starter); outside it falls back to an embedded minimal
 * template with the same shape. Dependency-free by design.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const idFlag = args.find((a) => a.startsWith('--id='))?.slice('--id='.length);

if (!target) {
  console.log('usage: create-pensiv-plugin <directory> [--id=com.you.my-plugin]');
  process.exit(1);
}

const dest = resolve(process.cwd(), target);
if (existsSync(dest)) {
  console.error(`✗ ${target} already exists`);
  process.exit(1);
}

const slug = target
  .split('/')
  .pop()
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/^-+|-+$/g, '');
const manifestId = idFlag ?? `com.example.${slug}`;
const displayName = slug
  .split('-')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

// Prefer the canonical sample when running inside the monorepo.
const here = dirname(fileURLToPath(import.meta.url));
const samplePath = resolve(here, '../../../plugins/sample-plugin');

if (existsSync(join(samplePath, 'manifest.json'))) {
  cpSync(samplePath, dest, {
    recursive: true,
    filter: (src) => !/node_modules|dist|\.pnsv-plugin$/.test(src)
  });
} else {
  mkdirSync(join(dest, 'src'), { recursive: true });
  writeFileSync(
    join(dest, 'manifest.json'),
    `${JSON.stringify(
      {
        $schema: 'https://pensiv.so/schemas/plugin-manifest-v1.json',
        id: manifestId,
        name: displayName,
        version: '0.1.0',
        description: 'Describe what your plugin does.',
        sdk: '^1.0.0',
        permissions: [],
        platforms: ['desktop', 'web'],
        license: 'MIT',
        contributes: { commands: [{ id: 'hello', name: `${displayName}: Say hello` }] }
      },
      null,
      2
    )}\n`
  );
  writeFileSync(
    join(dest, 'src', 'main.ts'),
    [
      "import { Plugin } from '@pensiv/plugin-sdk';",
      '',
      `export default class ${displayName.replace(/\s+/g, '')}Plugin extends Plugin {`,
      '  onload() {',
      "    this.addCommand({ id: 'hello', name: 'Say hello', run: () => this.app.ui.toast('hi') });",
      '  }',
      '}',
      ''
    ].join('\n')
  );
  writeFileSync(
    join(dest, 'package.json'),
    `${JSON.stringify(
      {
        name: slug,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: { build: 'vite build' },
        dependencies: { '@pensiv/plugin-sdk': '*' },
        devDependencies: { '@pensiv/build-config': '*', vite: '^6.0.0' }
      },
      null,
      2
    )}\n`
  );
}

// Rewrite identity in the cloned manifest/package.
const manifestPath = join(dest, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.id = manifestId;
manifest.name = displayName;
manifest.version = '0.1.0';
delete manifest.homepage;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const pkgPath = join(dest, 'package.json');
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.name = slug;
  pkg.version = '0.1.0';
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}
rmSync(join(dest, 'README.md'), { force: true });

console.log(
  [
    `✓ Scaffolded ${target}`,
    '',
    `  manifest id: ${manifestId}${idFlag ? '' : '   (change it — pass --id=com.you.name)'}`,
    '',
    'Next:',
    `  1. cd ${target} && npm install`,
    '  2. Edit src/main.ts (see AGENTS.md for the full Plugin API)',
    '  3. npm run build, then pack for local install:',
    '       node scripts/pack-plugin.mjs <dir>        (.pnsv-plugin for the app)',
    '  4. Publish SOURCE to the marketplace:',
    '       https://pensiv.so/community/publish/plugin  (or the in-app dialog)',
    '     Note: so.pensiv.* ids are reserved for first-party plugins.'
  ].join('\n')
);
