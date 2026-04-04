/**
 * Copies scaffold templates to dist/ so they are included in the npm package.
 * Called as post-build step after tsup.
 */
import { cpSync } from 'node:fs';

cpSync('src/scaffold/templates', 'dist/templates', { recursive: true });
