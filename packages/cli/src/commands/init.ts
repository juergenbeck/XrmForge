/**
 * @xrmforge/cli - Init Command
 *
 * Scaffolds a new D365 form scripting project.
 *
 * Usage:
 *   xrmforge init                         # Scaffold in current directory
 *   xrmforge init my-project              # Scaffold in ./my-project
 *   xrmforge init --prefix markant        # Use "markant" as publisher prefix
 *   xrmforge init --namespace Markant     # Use "Markant" as base namespace
 *   xrmforge init --skip-install          # Don't run npm install
 */

import type { Command } from 'commander';
import { resolve, basename } from 'node:path';
import { scaffoldProject } from '@xrmforge/devkit';

/** CLI options for the init command */
interface InitOptions {
  name?: string;
  prefix: string;
  namespace?: string;
  skipInstall: boolean;
  force: boolean;
}

/**
 * Register the 'init' subcommand on the CLI program.
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init [dir]')
    .description('Scaffold a new D365 form scripting project')

    .option('--name <name>', 'Project name for package.json (default: directory name)')
    .option('--prefix <prefix>', 'Publisher prefix for D365 WebResources', 'contoso')
    .option('--namespace <ns>', 'Base namespace for form scripts (default: PascalCase of prefix)')
    .option('--skip-install', 'Skip running npm install after scaffolding', false)
    .option('--force', 'Allow scaffolding in non-empty directories (skip existing files)', false)

    .action(async (dir: string | undefined, opts: InitOptions) => {
      try {
        await runInit(dir, opts);
      } catch (error) {
        if (error instanceof Error) {
          console.error(`\nError: ${error.message}\n`);
        } else {
          console.error('\nAn unexpected error occurred.\n');
        }
        process.exitCode = 1;
      }
    });
}

/**
 * Execute the init command.
 */
async function runInit(dir: string | undefined, opts: InitOptions): Promise<void> {
  const targetDir = resolve(dir ?? '.');
  const dirName = basename(targetDir);

  const projectName = opts.name ?? dirName;
  const prefix = opts.prefix;
  const namespace = opts.namespace ?? toPascalCase(prefix);

  console.log(`\nXrmForge Project Scaffolding`);
  console.log(`Directory:  ${targetDir}`);
  console.log(`Name:       ${projectName}`);
  console.log(`Prefix:     ${prefix}`);
  console.log(`Namespace:  ${namespace}`);
  console.log('');

  const result = await scaffoldProject({
    targetDir,
    projectName,
    prefix,
    namespace,
    force: opts.force,
  });

  console.log(`Created ${result.filesCreated.length} files:`);
  for (const file of result.filesCreated) {
    console.log(`  ${file}`);
  }

  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const w of result.warnings) {
      console.log(`  ${w}`);
    }
  }

  console.log('\nNext steps:');
  if (dir) {
    console.log(`  cd ${dir}`);
  }
  if (!opts.skipInstall) {
    console.log('  npm install');
  }
  console.log('  xrmforge generate --url https://YOUR-ORG.crm4.dynamics.com --auth interactive --entities account --output ./typings');
  console.log('  xrmforge build');
  console.log('');
}

/** Convert a string to PascalCase (e.g. "my-prefix" -> "MyPrefix") */
function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}
