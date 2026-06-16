/**
 * @xrmforge/cli - Generate Command
 *
 * Orchestrates type generation from a Dataverse environment.
 *
 * Usage:
 *   xrmforge generate --url https://myorg.crm4.dynamics.com \
 *     --auth client-credentials \
 *     --tenant <tenant-id> --client-id <app-id> --client-secret <secret> \
 *     --entities account,contact \
 *     --output ./generated
 *
 *   xrmforge generate --url https://myorg.crm4.dynamics.com \
 *     --auth interactive \
 *     --tenant <tenant-id> --client-id <app-id> \
 *     --entities account,contact,opportunity \
 *     --output ./generated \
 *     --label-language 1033 --secondary-language 1031
 *
 * Connection and credentials also resolve from XRMFORGE_* environment variables
 * (XRMFORGE_URL, XRMFORGE_TENANT_ID, XRMFORGE_CLIENT_ID, XRMFORGE_CLIENT_SECRET,
 * XRMFORGE_TOKEN). Precedence per value: explicit CLI flag > environment variable
 * > xrmforge.config.json. In CI, inject the secret as an env var rather than via
 * --client-secret (which would expose it in the process list):
 *
 *   XRMFORGE_URL=... XRMFORGE_TENANT_ID=... XRMFORGE_CLIENT_ID=... \
 *   XRMFORGE_CLIENT_SECRET=... \
 *     xrmforge generate --auth client-credentials   # scope/output from xrmforge.config.json
 */

import type { Command } from 'commander';
import { loadConfig, mergeWithCliOptions, applyEnvDefaults } from '../config.js';
import {
  TypeGenerationOrchestrator,
  createCredential,
  configureLogging,
  ConsoleLogSink,
  LogLevel,
  AuthenticationError,
  ConfigError,
  ErrorCode,
} from '@xrmforge/typegen';
import type { AuthConfig, CheckResult, CheckFinding } from '@xrmforge/typegen';

/** CLI options for the generate command (parsed by Commander.js). */
interface GenerateOptions {
  /** Dataverse environment URL (e.g. 'https://myorg.crm4.dynamics.com') */
  url: string;
  /** Authentication method ('client-credentials', 'interactive', 'device-code', 'token') */
  auth: string;
  /** Azure AD tenant ID */
  tenantId?: string;
  /** Azure AD application (client) ID */
  clientId?: string;
  /** Client secret for client-credentials auth */
  clientSecret?: string;
  /** Pre-acquired Bearer token for token auth */
  token?: string;
  /** Comma-separated entity logical names */
  entities?: string;
  /** Comma-separated solution unique names */
  solutions?: string;
  /** Output directory for generated .ts files */
  output: string;
  /** Primary label language LCID as string */
  labelLanguage: string;
  /** Secondary label language LCID as string */
  secondaryLanguage?: string;
  /** Whether to generate form interfaces */
  forms: boolean;
  /** Whether to generate OptionSet enums */
  optionsets: boolean;
  /** Whether to generate Custom API action executors */
  actions: boolean;
  /** Prefix filter for Custom API generation */
  actionsFilter?: string;
  /** Whether to enable metadata caching */
  cache: boolean;
  /** Directory for metadata cache files */
  cacheDir: string;
  /** Drift check mode: compare against outputDir without writing (exit 0/1/2) */
  check: boolean;
  /** Whether to enable verbose (debug) logging */
  verbose: boolean;
}

/**
 * Register the 'generate' subcommand on the CLI program.
 *
 * Adds options for Dataverse connection, authentication, entity scope,
 * output directory, label languages, feature toggles, and caching.
 *
 * @param program - The Commander.js program instance to register on
 */
export function registerGenerateCommand(program: Command): void {
  program
    .command('generate')
    .description('Generate TypeScript declarations from a Dataverse environment')

    // Connection (can come from xrmforge.config.json or XRMFORGE_* env vars)
    .option('--url <url>', 'Dataverse environment URL (e.g. https://myorg.crm4.dynamics.com). Falls back to XRMFORGE_URL.')
    .option('--auth <method>', 'Authentication method: client-credentials, interactive, device-code, token')

    // Auth credentials (each falls back to an XRMFORGE_* env var; precedence: flag > env > config file)
    .option('--tenant-id <id>', 'Azure AD tenant ID. Falls back to XRMFORGE_TENANT_ID.')
    .option('--client-id <id>', 'Azure AD application (client) ID. Falls back to XRMFORGE_CLIENT_ID.')
    .option('--client-secret <secret>', 'Client secret (for client-credentials auth). Prefer the XRMFORGE_CLIENT_SECRET env var over this flag.')
    .option('--token <token>', 'Pre-acquired Bearer token (for --auth token). Prefer XRMFORGE_TOKEN env var for security.')

    // Scope
    .option('--entities <list>', 'Comma-separated list of entity logical names (e.g. account,contact)')
    .option('--solutions <list>', 'Comma-separated solution unique names to discover entities')

    // Output
    .option('--output <dir>', 'Output directory for generated .ts files', './generated')

    // Labels
    .option('--label-language <code>', 'Primary label language code', '1033')
    .option('--secondary-language <code>', 'Secondary label language code (for dual-language JSDoc)')

    // Feature toggles
    .option('--no-forms', 'Skip form interface generation')
    .option('--no-optionsets', 'Skip OptionSet enum generation')
    // No Commander default for --actions: it must stay `undefined` when not passed
    // so a value from xrmforge.config.json can take effect (mergeWithCliOptions).
    // The orchestrator defaults generateActions to false, so CLI-only behavior is unchanged.
    .option('--actions', 'Generate Custom API Action/Function executors')
    .option('--actions-filter <prefix>', 'Only generate Custom APIs whose uniquename starts with this prefix (e.g. "markant_")')

    // Cache
    .option('--cache', 'Enable metadata cache for incremental generation', false)
    .option('--no-cache', 'Force full metadata refresh (disables cache)')
    .option('--cache-dir <dir>', 'Directory for metadata cache files', '.xrmforge/cache')

    // Drift check
    .option(
      '--check',
      'Drift check: generate in-memory and compare against the output directory without writing anything. ' +
      'Exit code: 0 = up to date, 1 = error, 2 = drift detected. Intended as a CI step. Ignores --cache.',
      false,
    )

    // Verbosity
    .option('-v, --verbose', 'Enable verbose logging', false)

    .action(async (opts: GenerateOptions) => {
      try {
        await runGenerate(opts);
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
 * Execute the generate command: validate options, authenticate, and run
 * the type generation orchestrator.
 *
 * @param cliOpts - Parsed CLI options merged with config file values
 */
async function runGenerate(cliOpts: GenerateOptions): Promise<void> {
  // Resolve options in three layers. Precedence: CLI flag > environment variable >
  // xrmforge.config.json. applyEnvDefaults runs BEFORE the config merge so an
  // XRMFORGE_* value out-ranks the config file but still yields to an explicit flag.
  const fileConfig = loadConfig();
  const cliWithEnv = applyEnvDefaults(cliOpts as unknown as Record<string, unknown>);
  const merged = mergeWithCliOptions(fileConfig, cliWithEnv);
  const opts = merged as unknown as GenerateOptions;

  // Warn when a secret/token was passed as a CLI flag: it is then exposed in the
  // shell history and the process list. Values resolved from the environment are
  // the preferred path and intentionally do not trigger this warning, so we key it
  // on the original cliOpts (before env resolution).
  if (cliOpts.clientSecret) {
    console.warn('WARNING: Passing --client-secret via CLI exposes it in shell history and the process list. Use the XRMFORGE_CLIENT_SECRET environment variable instead.');
  }
  if (cliOpts.token) {
    console.warn('WARNING: Using --token on the command line exposes the token in the process list and shell history.');
    console.warn('         Prefer setting the XRMFORGE_TOKEN environment variable instead.\n');
  }

  // Configure logging
  configureLogging({
    sink: new ConsoleLogSink(),
    minLevel: opts.verbose ? LogLevel.DEBUG : LogLevel.INFO,
  });

  // Validate required options (may come from config file)
  if (!opts.url) {
    throw new ConfigError(ErrorCode.CONFIG_INVALID, '--url is required. Set it via CLI flag or in xrmforge.config.json.', { option: 'url' });
  }
  if (!opts.auth) {
    throw new ConfigError(ErrorCode.CONFIG_INVALID, '--auth is required. Set it via CLI flag or in xrmforge.config.json.', { option: 'auth' });
  }
  if (!opts.entities && !opts.solutions) {
    throw new ConfigError(ErrorCode.CONFIG_INVALID, 'Either --entities or --solutions must be specified (CLI or xrmforge.config.json).', { option: 'entities' });
  }

  // Build auth config
  const authConfig = buildAuthConfig(opts);
  const credential = createCredential(authConfig);

  // Parse entity list
  const entities = opts.entities
    ? opts.entities.split(',').map((e) => e.trim().toLowerCase())
    : [];

  // Parse solutions list
  const solutionNames = opts.solutions
    ? opts.solutions.split(',').map((s) => s.trim())
    : [];

  if (entities.length === 0 && solutionNames.length === 0) {
    throw new ConfigError(ErrorCode.CONFIG_INVALID, 'No entities specified. Use --entities or --solutions.', { option: 'entities' });
  }

  // Build label config (R8-05: validate LCID)
  const primaryLanguage = parseInt(opts.labelLanguage, 10);
  if (isNaN(primaryLanguage)) {
    throw new ConfigError(ErrorCode.CONFIG_INVALID, `Invalid --label-language: "${opts.labelLanguage}". Must be a numeric LCID (e.g. 1033, 1031).`, { option: 'labelLanguage', value: opts.labelLanguage });
  }
  let secondaryLanguage: number | undefined;
  if (opts.secondaryLanguage) {
    secondaryLanguage = parseInt(opts.secondaryLanguage, 10);
    if (isNaN(secondaryLanguage)) {
      throw new ConfigError(ErrorCode.CONFIG_INVALID, `Invalid --secondary-language: "${opts.secondaryLanguage}". Must be a numeric LCID (e.g. 1033, 1031).`, { option: 'secondaryLanguage', value: opts.secondaryLanguage });
    }
  }

  console.log(`\nXrmForge Type Generator`);
  console.log(`Environment: ${opts.url}`);
  console.log(`Auth method: ${opts.auth}`);
  console.log(`Entities:    ${entities.length > 0 ? entities.join(', ') : '(none specified directly)'}`)
  if (solutionNames.length > 0) {
    console.log(`Solutions:   ${solutionNames.join(', ')}`);
  }
  console.log(`Output:      ${opts.output}`);
  console.log(`Languages:   ${primaryLanguage}${secondaryLanguage ? ` + ${secondaryLanguage}` : ''}`);
  if (opts.check) {
    console.log(`Mode:        drift check (read-only, nothing will be written)`);
    if (opts.cache) {
      console.warn(`Note:        --cache is ignored in check mode (the check must run against live metadata)`);
    }
  } else if (opts.cache) {
    console.log(`Cache:       enabled (${opts.cacheDir})`);
  }
  console.log('');

  // Create orchestrator and run
  const orchestrator = new TypeGenerationOrchestrator(credential, {
    environmentUrl: opts.url,
    entities,
    solutionNames: solutionNames.length > 0 ? solutionNames : undefined,
    outputDir: opts.output,
    labelConfig: { primaryLanguage, secondaryLanguage },
    generateForms: opts.forms,
    generateOptionSets: opts.optionsets,
    generateActions: opts.actions,
    actionsFilter: opts.actionsFilter,
    useCache: opts.cache,
    cacheDir: opts.cacheDir,
    checkOnly: opts.check,
  });

  // Support Ctrl+C and SIGTERM (R8-07: Docker/K8s sends SIGTERM)
  const controller = new AbortController();
  const onSignal = () => {
    console.log('\nAborting generation...');
    controller.abort();
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  const result = await orchestrator.generate({ signal: controller.signal });

  // Summary
  console.log('');
  console.log('Generation complete:');
  console.log(`  Entities:  ${result.entities.length}`);
  console.log(`  Files:     ${result.totalFiles}`);
  console.log(`  Warnings:  ${result.totalWarnings}`);
  console.log(`  Duration:  ${result.durationMs}ms`);
  if (result.cacheStats) {
    const cs = result.cacheStats;
    if (cs.fullRefresh) {
      console.log(`  Cache:     full refresh (${cs.entitiesFetched} entities fetched)`);
    } else {
      console.log(`  Cache:     ${cs.entitiesFromCache} from cache, ${cs.entitiesFetched} fetched, ${cs.entitiesDeleted} deleted`);
    }
  }

  // Show warnings
  if (result.totalWarnings > 0) {
    console.warn('\nWarnings:');
    for (const entity of result.entities) {
      for (const warning of entity.warnings) {
        console.warn(`  [${entity.entityLogicalName}] ${warning}`);
      }
    }
  }

  // Show failures
  const failures = result.entities.filter((e) => e.files.length === 0 && e.warnings.length > 0);
  if (failures.length > 0) {
    console.error(`\n${failures.length} entity/entities failed. See warnings above.`);
    process.exitCode = 1;
    return;
  }

  // Drift check report (check mode never writes anything)
  if (opts.check) {
    if (!result.checkResult) {
      // Defensive: without a complete generation there is no reliable comparison
      console.error('\nDrift check could not be completed (generation incomplete).');
      process.exitCode = 1;
      return;
    }
    printCheckReport(result.checkResult);
    if (result.checkResult.drift) {
      process.exitCode = 2;
    }
    return;
  }

  console.log(`\nTypes written to: ${opts.output}/`);
}

/** Display labels per file category, in report order */
const CHECK_CATEGORY_LABELS: ReadonlyArray<readonly [CheckFinding['type'], string]> = [
  ['entity', 'Entities'],
  ['fields', 'Fields'],
  ['form', 'Forms'],
  ['optionset', 'OptionSets'],
  ['action', 'Actions'],
];

/**
 * Print the drift check report, grouped by file category.
 *
 * Drift classes per file: "changed" (differs from live metadata),
 * "missing" (not on disk), "orphaned" (no longer generated).
 */
function printCheckReport(check: CheckResult): void {
  console.log('');
  if (!check.drift) {
    console.log(`Drift check passed: ${check.unchanged} files up to date.`);
    return;
  }

  console.log(`Drift detected: ${check.findings.length} finding(s), ${check.unchanged} files up to date.`);
  for (const [type, label] of CHECK_CATEGORY_LABELS) {
    const findings = check.findings.filter((f) => f.type === type);
    if (findings.length === 0) continue;
    console.log(`  ${label}:`);
    for (const finding of findings) {
      console.log(`    ${finding.status.padEnd(8)} ${finding.relativePath}`);
    }
  }
  console.log('');
  console.log('The checked-in generated files no longer match the live environment.');
  console.log('Run "xrmforge generate" (same options, without --check) and commit the result.');
  console.log('Note: a typegen/cli upgrade also reports drift (newer generator, different output).');
}

/**
 * Build an {@link AuthConfig} from already-resolved options.
 *
 * Maps the --auth method to the appropriate credential configuration and
 * validates that the required fields are present for each method. Pure: it does
 * not read environment variables or emit warnings - connection/credential values
 * (including XRMFORGE_* fallbacks) are resolved upstream by
 * {@link applyEnvDefaults}, and the insecure-flag warnings are emitted in
 * runGenerate against the original CLI options.
 *
 * @param opts - Resolved options containing auth method and credentials
 * @returns Validated authentication configuration
 * @throws {AuthenticationError} If required credentials are missing for the chosen method
 * @throws {ConfigError} If the auth method is unrecognized
 */
function buildAuthConfig(opts: GenerateOptions): AuthConfig {
  const method = opts.auth as AuthConfig['method'];

  switch (method) {
    case 'client-credentials':
      if (!opts.tenantId) throw new AuthenticationError(ErrorCode.AUTH_MISSING_CONFIG, '--tenant-id is required for client-credentials auth (or set XRMFORGE_TENANT_ID).', { method: 'client-credentials', missing: 'tenantId' });
      if (!opts.clientId) throw new AuthenticationError(ErrorCode.AUTH_MISSING_CONFIG, '--client-id is required for client-credentials auth (or set XRMFORGE_CLIENT_ID).', { method: 'client-credentials', missing: 'clientId' });
      if (!opts.clientSecret) throw new AuthenticationError(ErrorCode.AUTH_MISSING_CONFIG, '--client-secret is required for client-credentials auth (or set XRMFORGE_CLIENT_SECRET).', { method: 'client-credentials', missing: 'clientSecret' });
      return {
        method: 'client-credentials',
        tenantId: opts.tenantId,
        clientId: opts.clientId,
        clientSecret: opts.clientSecret,
      };

    case 'interactive':
      if (!opts.tenantId) throw new AuthenticationError(ErrorCode.AUTH_MISSING_CONFIG, '--tenant-id is required for interactive auth (or set XRMFORGE_TENANT_ID).', { method: 'interactive', missing: 'tenantId' });
      if (!opts.clientId) throw new AuthenticationError(ErrorCode.AUTH_MISSING_CONFIG, '--client-id is required for interactive auth (or set XRMFORGE_CLIENT_ID).', { method: 'interactive', missing: 'clientId' });
      return {
        method: 'interactive',
        tenantId: opts.tenantId,
        clientId: opts.clientId,
      };

    case 'device-code':
      if (!opts.tenantId) throw new AuthenticationError(ErrorCode.AUTH_MISSING_CONFIG, '--tenant-id is required for device-code auth (or set XRMFORGE_TENANT_ID).', { method: 'device-code', missing: 'tenantId' });
      if (!opts.clientId) throw new AuthenticationError(ErrorCode.AUTH_MISSING_CONFIG, '--client-id is required for device-code auth (or set XRMFORGE_CLIENT_ID).', { method: 'device-code', missing: 'clientId' });
      return {
        method: 'device-code',
        tenantId: opts.tenantId,
        clientId: opts.clientId,
      };

    case 'token': {
      // Token comes from --token or XRMFORGE_TOKEN; both are resolved upstream by
      // applyEnvDefaults, so buildAuthConfig only validates the resolved value.
      if (!opts.token) {
        throw new AuthenticationError(
          ErrorCode.AUTH_MISSING_CONFIG,
          'Token authentication requires a token. ' +
          'Set the XRMFORGE_TOKEN environment variable or use the --token flag.',
          { method: 'token', missing: 'token' },
        );
      }
      return { method: 'token', token: opts.token };
    }

    default:
      throw new ConfigError(
        ErrorCode.CONFIG_INVALID,
        `Unknown auth method: "${opts.auth}". ` +
        `Supported: client-credentials, interactive, device-code, token`,
        { option: 'auth', value: opts.auth },
      );
  }
}
