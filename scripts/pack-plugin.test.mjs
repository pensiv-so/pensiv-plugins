import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./pack-plugin.mjs', import.meta.url));

/** Run the packer against `dir`; returns the parsed `.pnsv-plugin` artifact. */
function pack(dir) {
  execFileSync('node', [SCRIPT, dir], { stdio: 'pipe' });
  const out = join(dir, `${basename(dir)}.pnsv-plugin`);
  return JSON.parse(readFileSync(out, 'utf8'));
}

describe('pack-plugin', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pack-plugin-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ id: 'com.test.plugin', name: 'Test' }));
    writeFileSync(join(dir, 'dist', 'main.js'), 'export default class {}');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('bundles manifest + code into the artifact', () => {
    const artifact = pack(dir);
    expect(artifact.manifest).toEqual({ id: 'com.test.plugin', name: 'Test' });
    expect(artifact.code).toBe('export default class {}');
    expect(artifact).not.toHaveProperty('css');
  });

  it('includes styles.css when present', () => {
    writeFileSync(join(dir, 'dist', 'styles.css'), '.x{color:red}');
    const artifact = pack(dir);
    expect(artifact.css).toBe('.x{color:red}');
  });

  it('exits non-zero when the build output is missing', () => {
    rmSync(join(dir, 'dist', 'main.js'));
    expect(() => execFileSync('node', [SCRIPT, dir], { stdio: 'pipe' })).toThrowError();
  });
});
