#!/usr/bin/env node
/**
 * Package a built plugin into a single `.pnsv-plugin` file the pensiv app installs.
 *
 *   node scripts/pack-plugin.mjs plugins/<name>
 *
 * Reads `<dir>/manifest.json` + `<dir>/dist/main.js` (+ optional
 * `<dir>/dist/styles.css`) and writes `<dir>/<name>.pnsv-plugin`, a JSON file:
 *   { manifest, code, css? }
 * Run `npm run build -w <plugin>` first.
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/pack-plugin.mjs plugins/<name>');
  process.exit(1);
}

const manifestPath = join(dir, 'manifest.json');
const codePath = join(dir, 'dist', 'main.js');
const cssPath = join(dir, 'dist', 'styles.css');

if (!existsSync(codePath)) {
  console.error(`Missing ${codePath} — run the plugin's build first.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const code = readFileSync(codePath, 'utf8');
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : undefined;

const artifact = { manifest, code, ...(css ? { css } : {}) };
const out = join(dir, `${basename(dir)}.pnsv-plugin`);
writeFileSync(out, JSON.stringify(artifact, null, 2));
console.log(`Packed ${manifest.id} → ${out} (${statSync(out).size} bytes)`);
