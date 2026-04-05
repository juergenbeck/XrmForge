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

/** Shape of xrmforge.config.json */
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
  /** Enable metadata cache for incremental generation */
  cache?: boolean;
  /** Directory for metadata cache files */
  cacheDir?: string;
  /** Build configuration for WebResource bundling */
  build?: BuildConfig;
}

const CONFIG_FILENAME = 'xrmforge.config.json';

/**
 * Load config from xrmforge.config.json in the current working directory.
 * Returns empty object if file doesn't exist.
 * Throws with clear message if file exists but is invalid JSON.
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
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ConfigError(ErrorCode.CONFIG_INVALID, `Invalid JSON in ${configPath}: ${error.message}`, { file: configPath });
    }
    throw error;
  }
}

/**
 * Merge config file values with CLI options.
 * CLI flags take precedence over config file.
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

  // Cache options
  if (merged['cache'] === undefined && config.cache !== undefined) {
    merged['cache'] = config.cache;
  }
  if (!merged['cacheDir'] && config.cacheDir) {
    merged['cacheDir'] = config.cacheDir;
  }

  return merged;
}
