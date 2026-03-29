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

import { Command } from 'commander';
import { registerGenerateCommand } from './commands/generate.js';

const program = new Command();

program
  .name('xrmforge')
  .description('TypeScript type generator for Dynamics 365 / Dataverse')
  .version('0.1.0');

registerGenerateCommand(program);

program.parse();
