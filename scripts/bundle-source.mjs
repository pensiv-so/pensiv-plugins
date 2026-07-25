#!/usr/bin/env node
/**
 * Bundle a plugin's SOURCE for marketplace publishing.
 *
 *   node scripts/bundle-source.mjs plugins/<name>
 *
 * The marketplace builds plugins server-side from source (import allowlist,
 * no npm install), so what you publish is `manifest.json` + `src/**` — not the
 * dist bundle. This script stages exactly what the server accepts, prints what
 * was included/excluded and cap usage, and writes `<dir>/<name>-source.zip`
 * for the homepage publish wizard (which also accepts picking the folder
 * directly — the zip is a convenience).
 *
 * Caps mirror the server (pensiv-core pluginPack.service): 100 files, 2 MB
 * total, 512 KB per file. Allowed source: manifest.json, src/**.{ts,tsx,js,
 * jsx,css,json}. README.md and screenshots/* are included too — the wizard
 * seeds the listing README and gallery from them.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';

const MAX_FILES = 100;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
const MAX_FILE_BYTES = 512 * 1024;
const ALLOWED_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.json']);
const SCREENSHOT_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const DENY = new Set(['node_modules', 'dist', '.git', 'coverage']);

const dir = process.argv[2];
if (!dir || !existsSync(join(dir, 'manifest.json'))) {
  console.error('usage: node scripts/bundle-source.mjs plugins/<name>   (needs manifest.json)');
  process.exit(1);
}

const included = [];
const excluded = [];
let totalBytes = 0;

function visit(rel) {
  const abs = join(dir, rel);
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (DENY.has(entry.name) || entry.name.startsWith('.')) continue;
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      visit(relPath);
      continue;
    }
    const ext = extname(entry.name).toLowerCase();
    // README.md plus localized README.<locale>.md variants — the publish
    // wizard combines them into the listing description per language.
    const isReadme = /^README(\.[a-z]{2}(-[a-z0-9-]+)?)?\.md$/i.test(relPath);
    const packable =
      relPath === 'manifest.json' ||
      isReadme ||
      relPath === 'styles.css' ||
      (relPath.startsWith('src/') && ALLOWED_EXT.has(ext)) ||
      (relPath.startsWith('screenshots/') && SCREENSHOT_EXT.has(ext));
    if (!packable) {
      excluded.push(relPath);
      continue;
    }
    const size = statSync(join(dir, relPath)).size;
    if (relPath === 'manifest.json' || relPath.startsWith('src/') || relPath === 'styles.css') {
      if (size > MAX_FILE_BYTES) {
        console.error(`✗ ${relPath} is ${(size / 1024).toFixed(0)} KB (max ${MAX_FILE_BYTES / 1024} KB)`);
        process.exit(1);
      }
      totalBytes += size;
    }
    included.push({ relPath, size });
  }
}
visit('');

const sourceCount = included.filter(
  (f) => f.relPath === 'manifest.json' || f.relPath.startsWith('src/') || f.relPath === 'styles.css'
).length;
if (sourceCount > MAX_FILES) {
  console.error(`✗ ${sourceCount} source files (max ${MAX_FILES})`);
  process.exit(1);
}
if (totalBytes > MAX_TOTAL_BYTES) {
  console.error(`✗ source is ${(totalBytes / 1024).toFixed(0)} KB (max ${MAX_TOTAL_BYTES / 1024} KB)`);
  process.exit(1);
}

console.log(`Including (${included.length}):`);
for (const f of included) console.log(`  + ${f.relPath}`);
if (excluded.length) {
  console.log(`Excluding (${excluded.length}):`);
  for (const p of excluded) console.log(`  - ${p}`);
}
console.log(
  `Caps: ${sourceCount}/${MAX_FILES} source files, ${(totalBytes / 1024).toFixed(0)}/${MAX_TOTAL_BYTES / 1024} KB`
);

// Stage + zip (uses the system `zip`; the web wizard also accepts the folder directly).
const stage = mkdtempSync(join(tmpdir(), 'pensiv-plugin-source-'));
try {
  for (const f of included) {
    cpSync(join(dir, f.relPath), join(stage, f.relPath));
  }
  const out = join(process.cwd(), dir, `${basename(dir)}-source.zip`);
  rmSync(out, { force: true });
  try {
    execFileSync('zip', ['-r', '-q', out, '.'], { cwd: stage });
    console.log(`\nWrote ${out}`);
    console.log('Upload it at https://pensiv.so/community/publish/plugin (or pick the folder there).');
  } catch {
    console.error('\n`zip` is not available — pick the plugin folder directly in the web publish wizard instead.');
    process.exitCode = 1;
  }
} finally {
  rmSync(stage, { recursive: true, force: true });
}
