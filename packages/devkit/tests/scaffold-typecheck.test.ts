import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { scaffoldProject } from '../src/scaffold/scaffold.js';

/**
 * K44-01: CI gate for the scaffold templates. The files `xrmforge init` writes
 * into a fresh project (error-handler.ts, example-form.ts, shared/*) are excluded
 * from the devkit tsc, so a type error in a template would ship in the npm tarball
 * unnoticed. This test scaffolds a real project into a temp dir and runs `tsc
 * --noEmit` against it with the EXACT generated tsconfig (no flag drift), resolving
 * `@xrmforge/*` and `@types/xrm` offline via symlinks (no `npm install`).
 *
 * Resolution requires the sibling packages to be built (turbo: devkit `test`
 * depends on `build`, which depends on `^build`, so helpers/dist exists here).
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const devkitRequire = createRequire(path.join(repoRoot, 'packages', 'devkit', 'package.json'));
const helpersRequire = createRequire(path.join(repoRoot, 'packages', 'helpers', 'package.json'));

let tmpDirs: string[] = [];

async function createTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'xrmforge-tscheck-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tmpDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

/** Symlink a real directory into the temp project's node_modules (junction on Windows). */
async function linkInto(nodeModules: string, request: string, target: string): Promise<void> {
  const dest = path.join(nodeModules, request);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.symlink(target, dest, 'junction');
}

describe('scaffolded project typechecks (K44-01)', () => {
  it('compiles the scaffolded src templates with tsc --noEmit (exit 0)', async () => {
    const dir = await createTmpDir();

    await scaffoldProject({
      targetDir: dir,
      projectName: 'typecheck-fixture',
      prefix: 'contoso',
      namespace: 'Contoso',
    });

    // helpers must be built (its .d.ts is what the templates compile against).
    const helpersTypes = path.join(repoRoot, 'packages', 'helpers', 'dist', 'index.d.ts');
    const helpersBuilt = await fs.access(helpersTypes).then(() => true).catch(() => false);
    expect(helpersBuilt, 'Build @xrmforge/helpers first (pnpm build) - dist/index.d.ts missing').toBe(true);

    // Resolve @types/xrm from the helpers package (devkit does not depend on it).
    const xrmPkgJson = helpersRequire.resolve('@types/xrm/package.json');
    const xrmDir = path.dirname(xrmPkgJson);

    // Provide the imports the scaffolded src/ needs, offline, with no flag drift:
    // @xrmforge/helpers (whole package dir, so its exports.types -> dist/index.d.ts
    // applies) and @types/xrm (for types: ["xrm"]).
    const nodeModules = path.join(dir, 'node_modules');
    await linkInto(nodeModules, '@xrmforge/helpers', path.join(repoRoot, 'packages', 'helpers'));
    await linkInto(nodeModules, path.join('@types', 'xrm'), xrmDir);

    // Run the REAL generated tsconfig unchanged (exact fidelity to what the user gets).
    const tscBin = devkitRequire.resolve('typescript/bin/tsc');
    const result = spawnSync(process.execPath, [tscBin, '--noEmit', '-p', path.join(dir, 'tsconfig.json')], {
      cwd: dir,
      encoding: 'utf-8',
    });

    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status, `tsc failed for scaffolded project:\n${output}`).toBe(0);
  }, 60_000);
});
