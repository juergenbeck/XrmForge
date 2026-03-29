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
 *     --output ./typings
 *
 *   xrmforge generate --url https://myorg.crm4.dynamics.com \
 *     --auth interactive \
 *     --tenant <tenant-id> --client-id <app-id> \
 *     --entities account,contact,opportunity \
 *     --output ./typings \
 *     --label-language 1033 --secondary-language 1031
 */

import type { Command } from 'commander';
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
  entities?: string;
  solution?: string;
  output: string;
  labelLanguage: string;
  secondaryLanguage?: string;
  forms: boolean;
  optionsets: boolean;
  verbose: boolean;
}

/**
 * Register the 'generate' subcommand on the CLI program.
 */
export function registerGenerateCommand(program: Command): void {
  program
    .command('generate')
    .description('Generate TypeScript declarations from a Dataverse environment')

    // Connection
    .requiredOption('--url <url>', 'Dataverse environment URL (e.g. https://myorg.crm4.dynamics.com)')
    .requiredOption('--auth <method>', 'Authentication method: client-credentials, interactive, device-code')

    // Auth credentials
    .option('--tenant-id <id>', 'Azure AD tenant ID')
    .option('--client-id <id>', 'Azure AD application (client) ID')
    .option('--client-secret <secret>', 'Client secret (for client-credentials auth)')

    // Scope
    .option('--entities <list>', 'Comma-separated list of entity logical names (e.g. account,contact)')
    .option('--solution <name>', 'Solution unique name to discover entities')

    // Output
    .option('--output <dir>', 'Output directory for generated .d.ts files', './typings')

    // Labels
    .option('--label-language <code>', 'Primary label language code', '1033')
    .option('--secondary-language <code>', 'Secondary label language code (for dual-language JSDoc)')

    // Feature toggles
    .option('--no-forms', 'Skip form interface generation')
    .option('--no-optionsets', 'Skip OptionSet enum generation')

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
        process.exit(1);
      }
    });
}

/**
 * Execute the generate command.
 */
async function runGenerate(opts: GenerateOptions): Promise<void> {
  // Configure logging
  configureLogging({
    sink: new ConsoleLogSink(),
    minLevel: opts.verbose ? LogLevel.DEBUG : LogLevel.INFO,
  });

  // Validate required options
  if (!opts.entities && !opts.solution) {
    throw new Error('Either --entities or --solution must be specified.');
  }

  // Build auth config
  const authConfig = buildAuthConfig(opts);
  const credential = createCredential(authConfig);

  // Parse entity list
  const entities = opts.entities
    ? opts.entities.split(',').map((e) => e.trim().toLowerCase())
    : [];

  if (entities.length === 0 && !opts.solution) {
    throw new Error('No entities specified. Use --entities or --solution.');
  }

  // Build label config
  const primaryLanguage = parseInt(opts.labelLanguage, 10);
  const secondaryLanguage = opts.secondaryLanguage
    ? parseInt(opts.secondaryLanguage, 10)
    : undefined;

  console.log(`\nXrmForge Type Generator v0.1.0`);
  console.log(`Environment: ${opts.url}`);
  console.log(`Auth method: ${opts.auth}`);
  console.log(`Entities:    ${entities.length > 0 ? entities.join(', ') : `(from solution: ${opts.solution})`}`);
  console.log(`Output:      ${opts.output}`);
  console.log(`Languages:   ${primaryLanguage}${secondaryLanguage ? ` + ${secondaryLanguage}` : ''}`);
  console.log('');

  // Create orchestrator and run
  const orchestrator = new TypeGenerationOrchestrator(credential, {
    environmentUrl: opts.url,
    entities,
    outputDir: opts.output,
    labelConfig: { primaryLanguage, secondaryLanguage },
    generateForms: opts.forms,
    generateOptionSets: opts.optionsets,
  });

  // Support Ctrl+C graceful shutdown
  const controller = new AbortController();
  process.on('SIGINT', () => {
    console.log('\nAborting generation...');
    controller.abort();
  });

  const result = await orchestrator.generate({ signal: controller.signal });

  // Summary
  console.log('');
  console.log('Generation complete:');
  console.log(`  Entities:  ${result.entities.length}`);
  console.log(`  Files:     ${result.totalFiles}`);
  console.log(`  Warnings:  ${result.totalWarnings}`);
  console.log(`  Duration:  ${result.durationMs}ms`);

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
    process.exit(1);
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

    default:
      throw new Error(
        `Unknown auth method: "${opts.auth}". ` +
        `Supported: client-credentials, interactive, device-code`,
      );
  }
}
