/**
 * @xrmforge/typegen - Type Generation Orchestrator
 *
 * Coordinates the full type generation pipeline:
 * 1. Fetch metadata for requested entities (via MetadataClient)
 * 2. Generate entity interfaces, OptionSet enums, form interfaces
 * 3. Write .d.ts files to disk
 *
 * This is the main entry point that ties all components together.
 */

import type { TokenCredential } from '@azure/identity';
import { MetadataClient } from '../metadata/client.js';
import { DataverseHttpClient } from '../http/client.js';
import { createLogger, type Logger } from '../logger.js';
import type { EntityTypeInfo, OptionSetMetadata } from '../metadata/types.js';
import { generateEntityInterface } from '../generators/entity-generator.js';
import { generateEntityOptionSets } from '../generators/optionset-generator.js';
import { generateEntityForms } from '../generators/form-generator.js';
import { addGeneratedHeader, writeAllFiles, generateBarrelIndex } from './file-writer.js';
import type {
  GenerateConfig,
  GenerationResult,
  EntityGenerationResult,
  GeneratedFile,
} from './types.js';

/**
 * Main orchestrator for type generation.
 *
 * Usage:
 * ```typescript
 * const orchestrator = new TypeGenerationOrchestrator(credential, {
 *   environmentUrl: 'https://myorg.crm4.dynamics.com',
 *   entities: ['account', 'contact'],
 *   outputDir: './typings',
 *   labelConfig: { primaryLanguage: 1033, secondaryLanguage: 1031 },
 * });
 * const result = await orchestrator.generate();
 * ```
 */
export class TypeGenerationOrchestrator {
  private readonly config: Required<GenerateConfig>;
  private readonly credential: TokenCredential;
  private readonly logger: Logger;

  constructor(credential: TokenCredential, config: GenerateConfig, logger?: Logger) {
    this.credential = credential;
    this.logger = logger ?? createLogger('orchestrator');

    // Apply defaults
    this.config = {
      environmentUrl: config.environmentUrl,
      entities: config.entities,
      outputDir: config.outputDir,
      labelConfig: config.labelConfig,
      generateEntities: config.generateEntities ?? true,
      generateForms: config.generateForms ?? true,
      generateOptionSets: config.generateOptionSets ?? true,
      useCache: config.useCache ?? true,
      cacheDir: config.cacheDir ?? '.xrmforge/cache',
      namespacePrefix: config.namespacePrefix ?? 'XrmForge',
    };
  }

  /**
   * Run the full type generation pipeline.
   */
  async generate(): Promise<GenerationResult> {
    const startTime = Date.now();
    const allFiles: GeneratedFile[] = [];
    const entityResults: EntityGenerationResult[] = [];

    this.logger.info('Starting type generation', {
      entities: this.config.entities,
      outputDir: this.config.outputDir,
    });

    // 1. Create HTTP client and metadata client
    const httpClient = new DataverseHttpClient({
      environmentUrl: this.config.environmentUrl,
      credential: this.credential,
    });

    const metadataClient = new MetadataClient(httpClient);

    // 2. Fetch metadata and generate for each entity (parallel, R7-07)
    // DataverseHttpClient already has concurrency control (maxConcurrency),
    // so parallel dispatch here is safe and significantly faster for 5+ entities.
    this.logger.info(`Processing ${this.config.entities.length} entities in parallel`);

    const settled = await Promise.allSettled(
      this.config.entities.map((entityName) =>
        this.processEntity(entityName, metadataClient).then((result) => {
          this.logger.info(`Completed entity: ${entityName} (${result.files.length} files)`);
          return result;
        }),
      ),
    );

    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i]!;
      const entityName = this.config.entities[i]!;

      if (outcome.status === 'fulfilled') {
        entityResults.push(outcome.value);
        allFiles.push(...outcome.value.files);
      } else {
        const errorMsg = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
        this.logger.error(`Failed to process entity: ${entityName}`, { error: outcome.reason });
        entityResults.push({
          entityLogicalName: entityName,
          files: [],
          warnings: [`Failed to process: ${errorMsg}`],
        });
      }
    }

    // 3. Write barrel index
    if (allFiles.length > 0) {
      const indexContent = generateBarrelIndex(allFiles);
      const indexFile: GeneratedFile = {
        relativePath: 'index.d.ts',
        absolutePath: '',
        content: indexContent,
        type: 'entity',
      };
      allFiles.push(indexFile);
    }

    // 4. Write all files to disk
    const filesWritten = await writeAllFiles(this.config.outputDir, allFiles);

    const durationMs = Date.now() - startTime;
    const totalWarnings = entityResults.reduce((sum, r) => sum + r.warnings.length, 0);

    this.logger.info('Type generation complete', {
      entities: entityResults.length,
      filesWritten,
      totalFiles: allFiles.length,
      totalWarnings,
      durationMs,
    });

    return {
      entities: entityResults,
      totalFiles: allFiles.length,
      totalWarnings,
      durationMs,
    };
  }

  /**
   * Process a single entity: fetch metadata, generate all output files.
   */
  private async processEntity(
    entityName: string,
    metadataClient: MetadataClient,
  ): Promise<EntityGenerationResult> {
    const warnings: string[] = [];
    const files: GeneratedFile[] = [];

    // Fetch complete metadata
    const entityInfo = await metadataClient.getEntityTypeInfo(entityName);

    // Generate entity interface
    if (this.config.generateEntities) {
      const entityContent = generateEntityInterface(entityInfo, {
        labelConfig: this.config.labelConfig,
        namespace: `${this.config.namespacePrefix}.Entities`,
      });
      files.push({
        relativePath: `entities/${entityName}.d.ts`,
        absolutePath: '',
        content: addGeneratedHeader(entityContent),
        type: 'entity',
      });
    }

    // Generate OptionSet enums
    if (this.config.generateOptionSets) {
      const picklistAttrs = this.getPicklistAttributes(entityInfo);

      if (picklistAttrs.length > 0) {
        const optionSets = generateEntityOptionSets(picklistAttrs, entityName, {
          labelConfig: this.config.labelConfig,
          namespace: `${this.config.namespacePrefix}.OptionSets`,
        });

        if (optionSets.length > 0) {
          // Combine all OptionSets for one entity into a single file
          const combinedContent = optionSets.map((os) => os.content).join('\n');
          files.push({
            relativePath: `optionsets/${entityName}.d.ts`,
            absolutePath: '',
            content: addGeneratedHeader(combinedContent),
            type: 'optionset',
          });
        }
      } else {
        warnings.push(`No OptionSet attributes found for ${entityName}`);
      }
    }

    // Generate form interfaces
    if (this.config.generateForms) {
      if (entityInfo.forms.length > 0) {
        const formResults = generateEntityForms(
          entityInfo.forms,
          entityName,
          entityInfo.attributes,
          {
            labelConfig: this.config.labelConfig,
            namespacePrefix: `${this.config.namespacePrefix}.Forms`,
          },
        );

        if (formResults.length > 0) {
          // Combine all forms for one entity into a single file
          const combinedContent = formResults.map((f) => f.content).join('\n');
          files.push({
            relativePath: `forms/${entityName}.d.ts`,
            absolutePath: '',
            content: addGeneratedHeader(combinedContent),
            type: 'form',
          });
        }
      } else {
        warnings.push(`No forms found for ${entityName}`);
      }
    }

    return { entityLogicalName: entityName, files, warnings };
  }

  /**
   * Extract picklist attributes with their OptionSet metadata.
   * Maps the raw EntityTypeInfo data to the format expected by the OptionSet generator.
   */
  private getPicklistAttributes(
    entityInfo: EntityTypeInfo,
  ): Array<{ SchemaName: string; OptionSet: OptionSetMetadata | null; GlobalOptionSet: OptionSetMetadata | null }> {
    const result: Array<{ SchemaName: string; OptionSet: OptionSetMetadata | null; GlobalOptionSet: OptionSetMetadata | null }> = [];

    for (const attr of entityInfo.picklistAttributes) {
      result.push({
        SchemaName: attr.SchemaName,
        OptionSet: attr.OptionSet ?? null,
        GlobalOptionSet: attr.GlobalOptionSet ?? null,
      });
    }

    // Also include State and Status attributes
    for (const attr of entityInfo.stateAttributes) {
      result.push({
        SchemaName: attr.SchemaName,
        OptionSet: attr.OptionSet ?? null,
        GlobalOptionSet: null,
      });
    }
    for (const attr of entityInfo.statusAttributes) {
      result.push({
        SchemaName: attr.SchemaName,
        OptionSet: attr.OptionSet ?? null,
        GlobalOptionSet: null,
      });
    }

    return result;
  }
}
