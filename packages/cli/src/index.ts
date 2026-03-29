/**
 * @xrmforge/cli - Command-line interface for XrmForge
 *
 * Usage:
 *   xrmforge generate --url https://myorg.crm4.dynamics.com \
 *     --auth client-credentials \
 *     --tenant <tenant-id> --client-id <app-id> --client-secret <secret> \
 *     --entities account,contact \
 *     --output ./typings
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { registerGenerateCommand } from './commands/generate.js';

// Read version from package.json (single source of truth)
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('xrmforge')
  .description('TypeScript type generator for Dynamics 365 / Dataverse')
  .version(pkg.version);

registerGenerateCommand(program);

program.parse();
