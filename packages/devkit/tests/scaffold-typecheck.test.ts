import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { scaffoldProject } from '../src/scaffold/scaffold.js';

/**
 * K44-01 (+ OE-25): CI gate for the scaffold templates. The files `xrmforge init`
 * writes into a fresh project are excluded from the devkit tsc, so a type error in a
 * template would ship in the npm tarball unnoticed. This test scaffolds a real project
 * into a temp dir and runs `tsc --noEmit` against BOTH generated tsconfigs (no flag
 * drift), resolving deps offline via symlinks (no `npm install`):
 * - tsconfig.json (src/ + generated/, strict, skipLibCheck false) needs @xrmforge/helpers
 *   and @types/xrm.
 * - tsconfig.tests.json (tests/, skipLibCheck true) additionally needs vitest and
 *   @types/node (OE-25: tests/ are now statically typechecked; the second `it` proves the
 *   pass has teeth).
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

/** Scaffold a fixture project and symlink the offline deps both generated tsconfigs resolve against. */
async function scaffoldWithDeps(dir: string): Promise<void> {
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

  // Resolve @types/xrm from helpers (devkit does not depend on it); vitest + @types/node from
  // devkit. Resolving from devkit points into the pnpm store, so vitest's own deps (@vitest/*)
  // resolve alongside it when tsc follows the symlink.
  const xrmDir = path.dirname(helpersRequire.resolve('@types/xrm/package.json'));
  const vitestDir = path.dirname(devkitRequire.resolve('vitest/package.json'));
  const nodeTypesDir = path.dirname(devkitRequire.resolve('@types/node/package.json'));

  const nodeModules = path.join(dir, 'node_modules');
  await linkInto(nodeModules, '@xrmforge/helpers', path.join(repoRoot, 'packages', 'helpers'));
  await linkInto(nodeModules, path.join('@types', 'xrm'), xrmDir);
  await linkInto(nodeModules, 'vitest', vitestDir);
  await linkInto(nodeModules, path.join('@types', 'node'), nodeTypesDir);
}

/** Run `tsc --noEmit -p <project>` in the fixture dir and return status + combined output. */
function runTsc(dir: string, project: string): { status: number | null; output: string } {
  const tscBin = devkitRequire.resolve('typescript/bin/tsc');
  const result = spawnSync(process.execPath, [tscBin, '--noEmit', '-p', path.join(dir, project)], {
    cwd: dir,
    encoding: 'utf-8',
  });
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

describe('scaffolded project typechecks (K44-01 + OE-25)', () => {
  it('compiles src/ (tsconfig.json) and tests/ (tsconfig.tests.json) with tsc --noEmit (exit 0)', async () => {
    const dir = await createTmpDir();
    await scaffoldWithDeps(dir);

    const main = runTsc(dir, 'tsconfig.json');
    expect(main.status, `main tsc failed for scaffolded project:\n${main.output}`).toBe(0);

    const tests = runTsc(dir, 'tsconfig.tests.json');
    expect(tests.status, `tests tsc failed for scaffolded project:\n${tests.output}`).toBe(0);
  }, 90_000);

  it('the tests/ typecheck has teeth: a type error in a test file fails tsconfig.tests.json (OE-25)', async () => {
    const dir = await createTmpDir();
    await scaffoldWithDeps(dir);

    // Inject a real type error into a test file (string assigned to a number).
    const badTest = path.join(dir, 'tests', 'forms', 'teeth.test.ts');
    await fs.writeFile(
      badTest,
      [
        "import { describe, it, expect } from 'vitest';",
        "describe('teeth', () => {",
        "  it('has a deliberate type error', () => {",
        '    const n: number = "not a number";',
        '    expect(n).toBe(0);',
        '  });',
        '});',
        '',
      ].join('\n'),
      'utf-8',
    );

    const tests = runTsc(dir, 'tsconfig.tests.json');
    expect(tests.status, 'tests tsc should fail on the injected type error').not.toBe(0);
    expect(tests.output).toContain('teeth.test.ts');
  }, 90_000);
});
