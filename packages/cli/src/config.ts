/**
 * @xrmforge/cli - Configuration File Support
 *
 * Reads xrmforge.config.json from the current working directory.
 * CLI flags override config file values.
 *
 * Example xrmforge.config.json:
 * ```json
 * {
 *   "url": "https://myorg.crm4.dynamics.com",
 *   "auth": "interactive",
 *   "tenantId": "your-tenant-id",
 *   "solutions": ["MySolution", "MyOtherSolution"],
 *   "entities": ["systemuser", "task"],
 *   "output": "./typings",
 *   "labelLanguage": 1033,
 *   "secondaryLanguage": 1031
 * }
 * ```
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { BuildConfig } from '@xrmforge/devkit';
import { ConfigError, ErrorCode } from '@xrmforge/typegen';

/**
 * Shape of xrmforge.config.json.
 *
 * Combines generate options (url, auth, entities) with build configuration.
 * All fields are optional since they can be provided via CLI flags.
 */
export interface XrmForgeConfig {
  /** Dataverse environment URL */
  url?: string;
  /** Authentication method */
  auth?: string;
  /** Azure AD tenant ID */
  tenantId?: string;
  /** Azure AD application (client) ID */
  clientId?: string;
  /** Client secret (NOT recommended in config file, use env vars) */
  clientSecret?: string;
  /** Entity logical names */
  entities?: string[];
  /** Solution unique names (array or comma-separated string) */
  solutions?: string[] | string;
  /** Output directory */
  output?: string;
  /** Primary label language LCID */
  labelLanguage?: number;
  /** Secondary label language LCID */
  secondaryLanguage?: number;
  /** Generate form interfaces */
  forms?: boolean;
  /** Generate OptionSet enums */
  optionsets?: boolean;
  /** Generate Custom API Action/Function executors */
  actions?: boolean;
  /** Only generate Custom APIs whose uniquename starts with this prefix (e.g. "markant_") */
  actionsFilter?: string;
  /** Enable metadata cache for incremental generation */
  cache?: boolean;
  /** Directory for metadata cache files */
  cacheDir?: string;
  /** Build configuration for WebResource bundling */
  build?: BuildConfig;
}

const CONFIG_FILENAME = 'xrmforge.config.json';

/**
 * Load configuration from xrmforge.config.json in the given working directory.
 *
 * Returns an empty object if the file does not exist.
 * Throws a {@link ConfigError} if the file exists but contains invalid JSON.
 * Emits a warning to stderr if clientSecret is found in the config file.
 *
 * @param cwd - Working directory to search for xrmforge.config.json (defaults to process.cwd())
 * @returns Parsed configuration object, or empty object if no config file exists
 * @throws {ConfigError} If the config file contains invalid JSON
 */
export function loadConfig(cwd: string = process.cwd()): XrmForgeConfig {
  const configPath = join(cwd, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as XrmForgeConfig;

    // Warn about secrets in config file
    if (config.clientSecret) {
      console.warn(`WARNING: clientSecret found in ${CONFIG_FILENAME}. This is a security risk.`);
      console.warn('         Use XRMFORGE_CLIENT_SECRET environment variable instead.\n');
    }

    return config;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      throw new ConfigError(ErrorCode.CONFIG_INVALID, `Invalid JSON in ${configPath}: ${error.message}`, { file: configPath });
    }
    throw error;
  }
}

/**
 * Merge config file values with CLI options.
 *
 * CLI flags always take precedence over config file values. Only fills
 * in config values for options not explicitly set via CLI. Handles type
 * conversions (e.g. config arrays to CLI comma-separated strings, numeric
 * LCIDs to string representations).
 *
 * @param config - Parsed xrmforge.config.json values
 * @param cliOpts - CLI options parsed by Commander.js
 * @returns Merged options with CLI taking precedence
 */
export function mergeWithCliOptions(
  config: XrmForgeConfig,
  cliOpts: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...cliOpts };

  // Only fill in values from config that weren't set via CLI
  if (!merged['url'] && config.url) merged['url'] = config.url;
  if (!merged['auth'] && config.auth) merged['auth'] = config.auth;
  if (!merged['tenantId'] && config.tenantId) merged['tenantId'] = config.tenantId;
  if (!merged['clientId'] && config.clientId) merged['clientId'] = config.clientId;
  if (!merged['clientSecret'] && config.clientSecret) merged['clientSecret'] = config.clientSecret;
  // Solutions: CLI comma-separated string vs config array
  if (!merged['solutions'] && config.solutions) {
    merged['solutions'] = Array.isArray(config.solutions)
      ? config.solutions.join(',')
      : config.solutions;
  }
  if (!merged['output'] && config.output) merged['output'] = config.output;

  // Entities: CLI comma-separated string vs config array
  if (!merged['entities'] && config.entities) {
    merged['entities'] = config.entities.join(',');
  }

  // Label languages: config uses numbers, CLI uses strings
  if (!merged['labelLanguage'] && config.labelLanguage) {
    merged['labelLanguage'] = String(config.labelLanguage);
  }
  if (!merged['secondaryLanguage'] && config.secondaryLanguage) {
    merged['secondaryLanguage'] = String(config.secondaryLanguage);
  }

  // Booleans: only override if explicitly set in config
  if (merged['forms'] === undefined && config.forms !== undefined) {
    merged['forms'] = config.forms;
  }
  if (merged['optionsets'] === undefined && config.optionsets !== undefined) {
    merged['optionsets'] = config.optionsets;
  }
  if (merged['actions'] === undefined && config.actions !== undefined) {
    merged['actions'] = config.actions;
  }

  // Custom API filter (string): CLI takes precedence over config
  if (!merged['actionsFilter'] && config.actionsFilter) {
    merged['actionsFilter'] = config.actionsFilter;
  }

  // Cache options
  if (merged['cache'] === undefined && config.cache !== undefined) {
    merged['cache'] = config.cache;
  }
  if (!merged['cacheDir'] && config.cacheDir) {
    merged['cacheDir'] = config.cacheDir;
  }

  return merged;
}

/**
 * Connection/credential options that can be supplied via XRMFORGE_* environment
 * variables, mapped from the option name to its environment variable.
 *
 * Generalizes the long-standing XRMFORGE_TOKEN fallback to the remaining
 * connection and credential values, so CI pipelines (and local shells) can supply
 * them via the environment instead of as command-line flags. That keeps secrets
 * out of the shell history and the process list (a flagged --client-secret is
 * visible in both).
 */
export const ENV_VAR_MAP: ReadonlyArray<readonly [string, string]> = [
  ['url', 'XRMFORGE_URL'],
  ['tenantId', 'XRMFORGE_TENANT_ID'],
  ['clientId', 'XRMFORGE_CLIENT_ID'],
  ['clientSecret', 'XRMFORGE_CLIENT_SECRET'],
  ['token', 'XRMFORGE_TOKEN'],
];

/**
 * Fill connection/credential options from XRMFORGE_* environment variables where
 * no CLI flag set them.
 *
 * Resolution precedence is: explicit CLI flag > environment variable >
 * xrmforge.config.json. To realize that, apply this BEFORE
 * {@link mergeWithCliOptions}: the environment value then out-ranks the config
 * file but still yields to an explicit flag. An empty-string environment variable
 * is treated as unset (an exported-but-empty XRMFORGE_CLIENT_SECRET= must not mask
 * a config-file value).
 *
 * The input is not mutated; a shallow copy is returned. The `env` parameter is
 * injectable for testing and defaults to {@link process.env}.
 *
 * @param cliOpts - CLI options parsed by Commander.js (an unset flag is `undefined`)
 * @param env - Environment lookup (defaults to process.env)
 * @returns A copy of cliOpts with environment-variable fallbacks applied
 */
export function applyEnvDefaults(
  cliOpts: Record<string, unknown>,
  env: Record<string, string | undefined> = process.env,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...cliOpts };

  for (const [optionKey, envVar] of ENV_VAR_MAP) {
    if (merged[optionKey] === undefined || merged[optionKey] === null) {
      const value = env[envVar];
      if (value !== undefined && value !== '') {
        merged[optionKey] = value;
      }
    }
  }

  return merged;
}
