/**
 * @xrmforge/devkit - esbuild Builder
 *
 * Builds D365 WebResources as IIFE bundles with named globals.
 * Abstracts esbuild so users never write esbuild config.
 */

import * as esbuild from 'esbuild';
import { stat, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import type { BuildConfig } from '../config.js';
import { resolveBuildConfig } from '../config.js';
import { BuildError, BuildErrorCode } from '../errors.js';
import type { BuildResult, BuildResultEntry } from './types.js';

/**
 * Build all entries defined in the config as IIFE bundles.
 *
 * @param config - Validated build configuration
 * @param cwd - Working directory for resolving relative paths (defaults to process.cwd())
 * @returns Build result with per-entry details
 */
export async function build(config: BuildConfig, cwd?: string): Promise<BuildResult> {
  const startTime = Date.now();
  const resolved = resolveBuildConfig(config);
  const basedir = cwd ?? process.cwd();
  const outDir = resolve(basedir, resolved.outDir);

  // Ensure output directory exists
  await mkdir(outDir, { recursive: true });

  const entryNames = Object.keys(resolved.entries);
  const results: BuildResultEntry[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Build all entries in parallel
  const settled = await Promise.allSettled(
    entryNames.map(async (name) => {
      const entry = resolved.entries[name]!;
      const entryStart = Date.now();
      const outFile = resolve(outDir, entry.out ?? `${name}.js`);

      // Ensure subdirectory exists for custom out paths
      await mkdir(dirname(outFile), { recursive: true });

      const buildOptions: esbuild.BuildOptions = {
        entryPoints: [resolve(basedir, entry.input)],
        bundle: true,
        format: 'iife',
        globalName: entry.namespace,
        outfile: outFile,
        target: [resolved.target],
        minify: resolved.minify,
        sourcemap: resolved.sourcemap,
        treeShaking: true,
        logLevel: 'silent',
        external: resolved.external,
      };

      const result = await esbuild.build(buildOptions);

      // Collect esbuild warnings
      for (const w of result.warnings) {
        warnings.push(`[${name}] ${w.text}`);
      }

      // Get output file size
      const stats = await stat(outFile);

      return {
        name,
        outFile,
        sizeBytes: stats.size,
        durationMs: Date.now() - entryStart,
      } satisfies BuildResultEntry;
    }),
  );

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i]!;
    const name = entryNames[i]!;

    if (outcome.status === 'fulfilled') {
      results.push(outcome.value);
    } else {
      const errorMsg = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      // Distinguish "file not found" from other build errors
      if (errorMsg.includes('Could not resolve') || errorMsg.includes('ENOENT')) {
        errors.push(`[${name}] ${new BuildError(BuildErrorCode.ENTRY_NOT_FOUND, errorMsg, { entry: name }).message}`);
      } else {
        errors.push(`[${name}] ${new BuildError(BuildErrorCode.BUILD_FAILED, errorMsg, { entry: name }).message}`);
      }
    }
  }

  return {
    entries: results,
    totalDurationMs: Date.now() - startTime,
    errors,
    warnings,
  };
}

/**
 * Start watch mode for all entries.
 * Returns a dispose function to stop watching.
 *
 * @param config - Validated build configuration
 * @param options - Watch options
 * @returns Object with dispose() to stop watching
 */
export async function watch(
  config: BuildConfig,
  options?: {
    cwd?: string;
    onRebuild?: (result: BuildResult) => void;
  },
): Promise<{ dispose: () => Promise<void> }> {
  const resolved = resolveBuildConfig(config);
  const basedir = options?.cwd ?? process.cwd();
  const outDir = resolve(basedir, resolved.outDir);

  await mkdir(outDir, { recursive: true });

  const contexts: esbuild.BuildContext[] = [];

  for (const [name, entry] of Object.entries(resolved.entries)) {
    const outFile = resolve(outDir, entry.out ?? `${name}.js`);
    await mkdir(dirname(outFile), { recursive: true });

    const ctx = await esbuild.context({
      entryPoints: [resolve(basedir, entry.input)],
      bundle: true,
      format: 'iife',
      globalName: entry.namespace,
      outfile: outFile,
      target: [resolved.target],
      minify: resolved.minify,
      sourcemap: resolved.sourcemap,
      treeShaking: true,
      logLevel: 'silent',
      external: resolved.external,
    });

    contexts.push(ctx);
    await ctx.watch();
  }

  return {
    dispose: async () => {
      for (const ctx of contexts) {
        await ctx.dispose();
      }
    },
  };
}
