import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { build } from '../src/builder/esbuild-builder.js';
import type { BuildConfig } from '../src/config.js';

let tmpDirs: string[] = [];

async function createTmpProject(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'xrmforge-build-test-'));
  tmpDirs.push(dir);

  for (const [filePath, content] of Object.entries(files)) {
    const abs = path.join(dir, filePath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf-8');
  }

  return dir;
}

afterEach(async () => {
  for (const dir of tmpDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

describe('esbuild-builder build()', () => {
  it('should build a single TypeScript entry to IIFE', async () => {
    const cwd = await createTmpProject({
      'src/account.ts': `
        export function onLoad() { console.log("loaded"); }
      `,
    });

    const config: BuildConfig = {
      entries: { account: { input: './src/account.ts', namespace: 'Contoso.Account' } },
    };

    const result = await build(config, cwd);

    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.name).toBe('account');
    expect(result.entries[0]!.sizeBytes).toBeGreaterThan(0);
    expect(result.entries[0]!.durationMs).toBeGreaterThanOrEqual(0);

    // Verify output file exists
    const outPath = path.join(cwd, 'dist', 'account.js');
    const content = await fs.readFile(outPath, 'utf-8');
    expect(content).toContain('Contoso');
  });

  it('should set globalName correctly with dotted namespace', async () => {
    const cwd = await createTmpProject({
      'src/form.ts': `
        export function onLoad() { return "hello"; }
        export function onSave() { return "saved"; }
      `,
    });

    const config: BuildConfig = {
      entries: { my_form: { input: './src/form.ts', namespace: 'Markant.Forms.Account' } },
    };

    const result = await build(config, cwd);
    expect(result.errors).toHaveLength(0);

    const content = await fs.readFile(path.join(cwd, 'dist', 'my_form.js'), 'utf-8');
    expect(content).toContain('Markant');
    // IIFE should expose the exports
    expect(content).toContain('onLoad');
    expect(content).toContain('onSave');
  });

  it('should build multiple entries in parallel', async () => {
    const cwd = await createTmpProject({
      'src/a.ts': 'export function a() { return 1; }',
      'src/b.ts': 'export function b() { return 2; }',
      'src/c.ts': 'export function c() { return 3; }',
    });

    const config: BuildConfig = {
      entries: {
        entry_a: { input: './src/a.ts', namespace: 'App.A' },
        entry_b: { input: './src/b.ts', namespace: 'App.B' },
        entry_c: { input: './src/c.ts', namespace: 'App.C' },
      },
    };

    const result = await build(config, cwd);

    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(3);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);

    // All output files should exist
    for (const name of ['entry_a', 'entry_b', 'entry_c']) {
      const exists = await fs.access(path.join(cwd, 'dist', `${name}.js`)).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }
  });

  it('should generate source maps when enabled', async () => {
    const cwd = await createTmpProject({
      'src/script.ts': 'export function run() {}',
    });

    const config: BuildConfig = {
      entries: { script: { input: './src/script.ts', namespace: 'Script' } },
      sourcemap: true,
    };

    const result = await build(config, cwd);
    expect(result.errors).toHaveLength(0);

    const mapExists = await fs.access(path.join(cwd, 'dist', 'script.js.map')).then(() => true).catch(() => false);
    expect(mapExists).toBe(true);
  });

  it('should not generate source maps when disabled', async () => {
    const cwd = await createTmpProject({
      'src/script.ts': 'export function run() {}',
    });

    const config: BuildConfig = {
      entries: { script: { input: './src/script.ts', namespace: 'Script' } },
      sourcemap: false,
    };

    const result = await build(config, cwd);
    expect(result.errors).toHaveLength(0);

    const mapExists = await fs.access(path.join(cwd, 'dist', 'script.js.map')).then(() => true).catch(() => false);
    expect(mapExists).toBe(false);
  });

  it('should minify when enabled', async () => {
    const cwd = await createTmpProject({
      'src/script.ts': `
        export function longFunctionName() {
          const veryLongVariableName = "hello world";
          return veryLongVariableName + " from function";
        }
      `,
    });

    // Build without minification
    const normalResult = await build(
      { entries: { script: { input: './src/script.ts', namespace: 'S' } }, minify: false },
      cwd,
    );

    // Build with minification to a different dir
    const minResult = await build(
      { entries: { script: { input: './src/script.ts', namespace: 'S' } }, minify: true, outDir: './dist-min' },
      cwd,
    );

    expect(normalResult.errors).toHaveLength(0);
    expect(minResult.errors).toHaveLength(0);
    expect(minResult.entries[0]!.sizeBytes).toBeLessThan(normalResult.entries[0]!.sizeBytes);
  });

  it('should use custom outDir', async () => {
    const cwd = await createTmpProject({
      'src/script.ts': 'export function run() {}',
    });

    const config: BuildConfig = {
      entries: { script: { input: './src/script.ts', namespace: 'S' } },
      outDir: './build-output',
    };

    const result = await build(config, cwd);
    expect(result.errors).toHaveLength(0);

    const exists = await fs.access(path.join(cwd, 'build-output', 'script.js')).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('should use custom out filename per entry', async () => {
    const cwd = await createTmpProject({
      'src/account.ts': 'export function onLoad() {}',
    });

    const config: BuildConfig = {
      entries: {
        account: { input: './src/account.ts', namespace: 'Contoso.Account', out: 'contoso_account.js' },
      },
    };

    const result = await build(config, cwd);
    expect(result.errors).toHaveLength(0);

    const exists = await fs.access(path.join(cwd, 'dist', 'contoso_account.js')).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('should report error for missing input file', async () => {
    const cwd = await createTmpProject({});

    const config: BuildConfig = {
      entries: { missing: { input: './src/nonexistent.ts', namespace: 'Missing' } },
    };

    const result = await build(config, cwd);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('missing');
    expect(result.entries).toHaveLength(0);
  });

  it('should report error for TypeScript syntax errors', async () => {
    const cwd = await createTmpProject({
      'src/bad.ts': 'export function broken( { return }',
    });

    const config: BuildConfig = {
      entries: { bad: { input: './src/bad.ts', namespace: 'Bad' } },
    };

    const result = await build(config, cwd);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('bad');
  });

  it('should exclude external modules', async () => {
    const cwd = await createTmpProject({
      'src/script.ts': `
        import * as fs from 'fs';
        export function run() { return fs.existsSync('.'); }
      `,
    });

    const config: BuildConfig = {
      entries: { script: { input: './src/script.ts', namespace: 'S' } },
      external: ['fs'],
    };

    const result = await build(config, cwd);
    expect(result.errors).toHaveLength(0);

    const content = await fs.readFile(path.join(cwd, 'dist', 'script.js'), 'utf-8');
    // fs should be required, not bundled
    expect(content).toContain('require("fs")');
  });

  it('should handle partial failures gracefully', async () => {
    const cwd = await createTmpProject({
      'src/good.ts': 'export function ok() {}',
    });

    const config: BuildConfig = {
      entries: {
        good: { input: './src/good.ts', namespace: 'Good' },
        bad: { input: './src/nonexistent.ts', namespace: 'Bad' },
      },
    };

    const result = await build(config, cwd);

    // good should succeed, bad should fail
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.name).toBe('good');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('bad');
  });
});
