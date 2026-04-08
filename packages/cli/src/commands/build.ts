/**
 * @xrmforge/cli - Build Command
 *
 * Builds WebResources as IIFE bundles for Dynamics 365.
 *
 * Usage:
 *   xrmforge build                  # Build all entries from xrmforge.config.json
 *   xrmforge build --watch          # Watch mode with incremental rebuilds
 *   xrmforge build --minify         # Minify output bundles
 *   xrmforge build --no-sourcemap   # Disable source maps
 */

import type { Command } from 'commander';
import { loadConfig } from '../config.js';
import {
  validateBuildConfig,
  build,
  watch,
} from '@xrmforge/devkit';
import { ConfigError, ErrorCode } from '@xrmforge/typegen';

/** CLI options for the build command (parsed by Commander.js). */
interface BuildOptions {
  /** Whether to run in watch mode with incremental rebuilds */
  watch: boolean;
  /** Whether to minify output bundles */
  minify?: boolean;
  /** Whether to generate source maps (default: true) */
  sourcemap: boolean;
  /** Override output directory from config */
  outDir?: string;
  /** Whether to enable verbose logging */
  verbose: boolean;
}

/**
 * Register the 'build' subcommand on the CLI program.
 *
 * Adds options for watch mode, minification, source maps,
 * output directory override, and verbose logging.
 *
 * @param program - The Commander.js program instance to register on
 */
export function registerBuildCommand(program: Command): void {
  program
    .command('build')
    .description('Build WebResources as IIFE bundles for Dynamics 365')

    .option('--watch', 'Watch mode with incremental rebuilds', false)
    .option('--minify', 'Minify output bundles')
    .option('--no-sourcemap', 'Disable source maps')
    .option('--out-dir <dir>', 'Override output directory')
    .option('-v, --verbose', 'Verbose logging', false)

    .action(async (opts: BuildOptions) => {
      try {
        await runBuild(opts);
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error(`\nError: ${error.message}\n`);
          if (opts.verbose && error.stack) {
            console.error(error.stack);
          }
        } else {
          console.error('\nAn unexpected error occurred.\n');
        }
        process.exitCode = 1;
      }
    });
}

/**
 * Execute the build command: load config, validate, and invoke esbuild
 * for a single build or watch mode.
 *
 * @param opts - Parsed CLI options for the build command
 */
async function runBuild(opts: BuildOptions): Promise<void> {
  const fileConfig = loadConfig();

  if (!fileConfig.build) {
    throw new ConfigError(
      ErrorCode.CONFIG_INVALID,
      'No "build" section found in xrmforge.config.json.\n' +
      'Add a build configuration with entries to get started:\n\n' +
      '  {\n' +
      '    "build": {\n' +
      '      "entries": {\n' +
      '        "my_script": {\n' +
      '          "input": "./src/my-script.ts",\n' +
      '          "namespace": "Contoso.MyScript"\n' +
      '        }\n' +
      '      }\n' +
      '    }\n' +
      '  }\n',
      { section: 'build' },
    );
  }

  // Apply CLI overrides
  const buildConfig = { ...fileConfig.build };
  if (opts.outDir) buildConfig.outDir = opts.outDir;
  if (opts.minify !== undefined) buildConfig.minify = opts.minify;
  if (!opts.sourcemap) buildConfig.sourcemap = false;

  // Validate
  const validated = validateBuildConfig(buildConfig);

  const entryCount = Object.keys(validated.entries).length;
  console.log(`\nXrmForge Build (esbuild)`);
  console.log(`Entries: ${entryCount}`);
  console.log('');

  if (opts.watch) {
    // Watch mode
    console.log('Watching for changes...\n');

    const watcher = await watch(validated, {
      onRebuild: (result) => {
        if (result.errors.length > 0) {
          for (const err of result.errors) {
            console.error(`  ${err}`);
          }
        } else {
          console.log(`  Rebuilt ${result.entries.length} entries in ${result.totalDurationMs}ms`);
        }
      },
    });

    // Support Ctrl+C and SIGTERM
    const onSignal = () => {
      console.log('\nStopping watch mode...');
      watcher.dispose().then(() => process.exit(0));
    };
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);

    // Keep process alive
    await new Promise(() => {});
  }

  // Single build
  const result = await build(validated);

  // Print results table
  for (const entry of result.entries) {
    const size = formatSize(entry.sizeBytes);
    const duration = `${entry.durationMs}ms`;
    console.log(`  ${entry.name.padEnd(30)} ${size.padStart(10)}  ${duration.padStart(8)}`);
  }

  console.log('');

  if (result.errors.length > 0) {
    console.error('Errors:');
    for (const err of result.errors) {
      console.error(`  ${err}`);
    }
    console.error('');
    process.exitCode = 1;
    return;
  }

  console.log(`${result.entries.length} entries built in ${result.totalDurationMs}ms\n`);
}

/**
 * Format a byte count to a human-readable string (e.g. '12.3 kB').
 *
 * @param bytes - File size in bytes
 * @returns Formatted string with appropriate unit
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} kB`;
}
