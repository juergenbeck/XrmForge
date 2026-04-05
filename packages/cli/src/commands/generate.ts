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
 */

import type { Command } from 'commander';
import { loadConfig, mergeWithCliOptions } from '../config.js';
import {
  TypeGenerationOrchestrator,
  createCredential,
  configureLogging,
  ConsoleLogSink,
  LogLevel,
} from '@xrmforge/typegen';
import type { AuthConfig } from '@xrmforge/typegen';

/** CLI options for the generate command */
interface GenerateOptions {
  url: string;
  auth: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  token?: string;
  entities?: string;
  solutions?: string;
  output: string;
  labelLanguage: string;
  secondaryLanguage?: string;
  forms: boolean;
  optionsets: boolean;
  actions: boolean;
  actionsFilter?: string;
  cache: boolean;
  cacheDir: string;
  verbose: boolean;
}

/**
 * Register the 'generate' subcommand on the CLI program.
 */
export function registerGenerateCommand(program: Command): void {
  program
    .command('generate')
    .description('Generate TypeScript declarations from a Dataverse environment')

    // Connection (can come from xrmforge.config.json)
    .option('--url <url>', 'Dataverse environment URL (e.g. https://myorg.crm4.dynamics.com)')
    .option('--auth <method>', 'Authentication method: client-credentials, interactive, device-code, token')

    // Auth credentials
    .option('--tenant-id <id>', 'Azure AD tenant ID')
    .option('--client-id <id>', 'Azure AD application (client) ID')
    .option('--client-secret <secret>', 'Client secret (for client-credentials auth)')
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
    .option('--actions', 'Generate Custom API Action/Function executors', false)
    .option('--actions-filter <prefix>', 'Only generate Custom APIs whose uniquename starts with this prefix (e.g. "markant_")')

    // Cache
    .option('--cache', 'Enable metadata cache for incremental generation', false)
    .option('--no-cache', 'Force full metadata refresh (disables cache)')
    .option('--cache-dir <dir>', 'Directory for metadata cache files', '.xrmforge/cache')

    // Verbosity
    .option('-v, --verbose', 'Enable verbose logging', false)

    .action(async (opts: GenerateOptions) => {
      try {
        await runGenerate(opts);
      } catch (error) {
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
 * Execute the generate command.
 */
async function runGenerate(cliOpts: GenerateOptions): Promise<void> {
  // Load config file and merge with CLI options (CLI takes precedence)
  const fileConfig = loadConfig();
  const merged = mergeWithCliOptions(fileConfig, cliOpts as unknown as Record<string, unknown>);
  const opts = merged as unknown as GenerateOptions;

  // Configure logging
  configureLogging({
    sink: new ConsoleLogSink(),
    minLevel: opts.verbose ? LogLevel.DEBUG : LogLevel.INFO,
  });

  // Validate required options (may come from config file)
  if (!opts.url) {
    throw new Error('--url is required. Set it via CLI flag or in xrmforge.config.json.');
  }
  if (!opts.auth) {
    throw new Error('--auth is required. Set it via CLI flag or in xrmforge.config.json.');
  }
  if (!opts.entities && !opts.solutions) {
    throw new Error('Either --entities or --solutions must be specified (CLI or xrmforge.config.json).');
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
    throw new Error('No entities specified. Use --entities or --solutions.');
  }

  // Build label config (R8-05: validate LCID)
  const primaryLanguage = parseInt(opts.labelLanguage, 10);
  if (isNaN(primaryLanguage)) {
    throw new Error(`Invalid --label-language: "${opts.labelLanguage}". Must be a numeric LCID (e.g. 1033, 1031).`);
  }
  let secondaryLanguage: number | undefined;
  if (opts.secondaryLanguage) {
    secondaryLanguage = parseInt(opts.secondaryLanguage, 10);
    if (isNaN(secondaryLanguage)) {
      throw new Error(`Invalid --secondary-language: "${opts.secondaryLanguage}". Must be a numeric LCID (e.g. 1033, 1031).`);
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
  if (opts.cache) {
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
    console.log('\nWarnings:');
    for (const entity of result.entities) {
      for (const warning of entity.warnings) {
        console.log(`  [${entity.entityLogicalName}] ${warning}`);
      }
    }
  }

  // Show failures
  const failures = result.entities.filter((e) => e.files.length === 0 && e.warnings.length > 0);
  if (failures.length > 0) {
    console.log(`\n${failures.length} entity/entities failed. See warnings above.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nTypes written to: ${opts.output}/`);
}

/**
 * Build AuthConfig from CLI options.
 */
function buildAuthConfig(opts: GenerateOptions): AuthConfig {
  const method = opts.auth as AuthConfig['method'];

  switch (method) {
    case 'client-credentials':
      if (!opts.tenantId) throw new Error('--tenant-id is required for client-credentials auth.');
      if (!opts.clientId) throw new Error('--client-id is required for client-credentials auth.');
      if (!opts.clientSecret) throw new Error('--client-secret is required for client-credentials auth.');
      if (opts.clientSecret) {
        console.warn('WARNING: Passing --client-secret via CLI exposes it in shell history. Use XRMFORGE_CLIENT_SECRET environment variable instead.');
      }
      return {
        method: 'client-credentials',
        tenantId: opts.tenantId,
        clientId: opts.clientId,
        clientSecret: opts.clientSecret,
      };

    case 'interactive':
      if (!opts.tenantId) throw new Error('--tenant-id is required for interactive auth.');
      if (!opts.clientId) throw new Error('--client-id is required for interactive auth.');
      return {
        method: 'interactive',
        tenantId: opts.tenantId,
        clientId: opts.clientId,
      };

    case 'device-code':
      if (!opts.tenantId) throw new Error('--tenant-id is required for device-code auth.');
      if (!opts.clientId) throw new Error('--client-id is required for device-code auth.');
      return {
        method: 'device-code',
        tenantId: opts.tenantId,
        clientId: opts.clientId,
      };

    case 'token': {
      // Token from --token flag or XRMFORGE_TOKEN environment variable
      const token = opts.token || process.env['XRMFORGE_TOKEN'];
      if (!token) {
        throw new Error(
          'Token authentication requires a token. ' +
          'Set XRMFORGE_TOKEN environment variable or use --token flag.',
        );
      }
      if (opts.token) {
        console.warn('WARNING: Using --token on the command line exposes the token in process list and shell history.');
        console.warn('         Prefer setting XRMFORGE_TOKEN environment variable instead.\n');
      }
      return { method: 'token', token };
    }

    default:
      throw new Error(
        `Unknown auth method: "${opts.auth}". ` +
        `Supported: client-credentials, interactive, device-code, token`,
      );
  }
}
