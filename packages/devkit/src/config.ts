/**
 * @xrmforge/devkit - Build Configuration
 *
 * Types and validation for the `build` section in xrmforge.config.json.
 */

import { BuildError, BuildErrorCode } from './errors.js';

/** A single build entry (one WebResource) */
export interface BuildEntry {
  /** Relative path to the TypeScript source file */
  input: string;
  /** Global namespace for D365 form event binding (e.g. "Contoso.Account") */
  namespace: string;
  /** Optional output filename relative to outDir (defaults to entry key + ".js") */
  out?: string;
}

/** Build configuration for WebResource bundling */
export interface BuildConfig {
  /** Bundler to use (currently only "esbuild") */
  bundler?: 'esbuild';
  /** Named build entries: key = entry name, value = entry config */
  entries: Record<string, BuildEntry>;
  /** Output directory for built bundles (default: "./dist") */
  outDir?: string;
  /** JavaScript target version (default: "es2020") */
  target?: string;
  /** Generate source maps (default: true) */
  sourcemap?: boolean;
  /** Minify output (default: false) */
  minify?: boolean;
  /** Additional modules to exclude from bundling */
  external?: string[];
}

/** Fully resolved build config with all defaults applied */
export interface ResolvedBuildConfig {
  bundler: 'esbuild';
  entries: Record<string, BuildEntry>;
  outDir: string;
  target: string;
  sourcemap: boolean;
  minify: boolean;
  external: string[];
}

/**
 * Validate a raw build config object.
 * Throws BuildError with CONFIG_INVALID if any required field is missing or invalid.
 */
export function validateBuildConfig(raw: unknown): BuildConfig {
  if (!raw || typeof raw !== 'object') {
    throw new BuildError(
      BuildErrorCode.CONFIG_INVALID,
      'Build configuration must be an object.',
    );
  }

  const config = raw as Record<string, unknown>;

  // entries: required, non-empty object
  if (!config['entries'] || typeof config['entries'] !== 'object' || Array.isArray(config['entries'])) {
    throw new BuildError(
      BuildErrorCode.CONFIG_INVALID,
      'Build configuration requires an "entries" object with at least one entry.',
    );
  }

  const entries = config['entries'] as Record<string, unknown>;
  const entryNames = Object.keys(entries);

  if (entryNames.length === 0) {
    throw new BuildError(
      BuildErrorCode.CONFIG_INVALID,
      'Build configuration requires at least one entry in "entries".',
    );
  }

  for (const name of entryNames) {
    const entry = entries[name] as Record<string, unknown> | undefined;

    if (!entry || typeof entry !== 'object') {
      throw new BuildError(
        BuildErrorCode.CONFIG_INVALID,
        `Entry "${name}" must be an object with "input" and "namespace".`,
        { entry: name },
      );
    }

    if (!entry['input'] || typeof entry['input'] !== 'string') {
      throw new BuildError(
        BuildErrorCode.CONFIG_INVALID,
        `Entry "${name}" requires an "input" field (path to .ts source file).`,
        { entry: name },
      );
    }

    if (!entry['namespace'] || typeof entry['namespace'] !== 'string') {
      throw new BuildError(
        BuildErrorCode.CONFIG_INVALID,
        `Entry "${name}" requires a "namespace" field (e.g. "Contoso.Account").`,
        { entry: name },
      );
    }
  }

  // bundler: optional, must be "esbuild" if set
  if (config['bundler'] !== undefined && config['bundler'] !== 'esbuild') {
    throw new BuildError(
      BuildErrorCode.CONFIG_INVALID,
      `Unsupported bundler: "${String(config['bundler'])}". Currently only "esbuild" is supported.`,
      { bundler: config['bundler'] },
    );
  }

  return config as unknown as BuildConfig;
}

/**
 * Apply default values to a validated build config.
 */
export function resolveBuildConfig(config: BuildConfig): ResolvedBuildConfig {
  return {
    bundler: config.bundler ?? 'esbuild',
    entries: config.entries,
    outDir: config.outDir ?? './dist',
    target: config.target ?? 'es2020',
    sourcemap: config.sourcemap ?? true,
    minify: config.minify ?? false,
    external: config.external ?? [],
  };
}
