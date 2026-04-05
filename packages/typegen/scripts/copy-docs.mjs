/**
 * Copies architecture docs from the monorepo root into the typegen package
 * so they are included in the npm tarball.
 *
 * Sources:
 *   <monorepo-root>/docs/architecture/  -> packages/typegen/docs/architecture/  (English)
 *   <monorepo-root>/docs/architektur/   -> packages/typegen/docs/architektur/   (German)
 *
 * Called as post-build step after tsup.
 */
import { cpSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const pairs = [
  { source: '../../docs/architecture', target: './docs/architecture' },
  { source: '../../docs/architektur', target: './docs/architektur' },
];

for (const { source, target } of pairs) {
  const sourceDir = resolve(source);
  const targetDir = resolve(target);

  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true });
  }

  if (existsSync(sourceDir)) {
    cpSync(sourceDir, targetDir, { recursive: true });
  }
}
