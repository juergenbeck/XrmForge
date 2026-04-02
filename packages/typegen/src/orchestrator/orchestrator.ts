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
import { generateActionDeclarations, generateActionModule, groupCustomApis } from '../generators/action-generator.js';
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

    // @alpha: useCache is not yet implemented (planned for v0.2.0)
    if (config.useCache) {
      throw new Error(
        'Metadata caching is not yet implemented (planned for v0.2.0). ' +
        'Remove the useCache option or set it to false.',
      );
    }

    // Apply defaults
    this.config = {
      environmentUrl: config.environmentUrl,
      entities: [...config.entities],
      solutionNames: config.solutionNames ?? [],
      outputDir: config.outputDir,
      labelConfig: config.labelConfig,
      generateEntities: config.generateEntities ?? true,
      generateForms: config.generateForms ?? true,
      generateOptionSets: config.generateOptionSets ?? true,
      generateActions: config.generateActions ?? false,
      actionsFilter: config.actionsFilter ?? '',
      useCache: config.useCache ?? false,
      cacheDir: config.cacheDir ?? '.xrmforge/cache',
      namespacePrefix: config.namespacePrefix ?? 'XrmForge',
    };
  }

  /**
   * Run the full type generation pipeline.
   *
   * @param options - Optional parameters
   * @param options.signal - AbortSignal to cancel the generation process.
   *   When aborted, entities that have not yet started processing are skipped.
   *   Entities already in progress may still complete or fail with an abort error.
   */
  async generate(options?: { signal?: AbortSignal }): Promise<GenerationResult> {
    const signal = options?.signal;
    const startTime = Date.now();
    const allFiles: GeneratedFile[] = [];
    const entityResults: EntityGenerationResult[] = [];

    // Check abort before starting
    if (signal?.aborted) {
      return { entities: [], totalFiles: 0, totalWarnings: 0, durationMs: 0 };
    }

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

    // 1b. Resolve solution entities if solutionNames is set
    if (this.config.solutionNames && this.config.solutionNames.length > 0) {
      this.logger.info(`Resolving entities from ${this.config.solutionNames.length} solution(s): ${this.config.solutionNames.join(', ')}`);
      const solutionEntityNames = await metadataClient.getEntityNamesForSolutions(this.config.solutionNames);
      this.logger.info(`Found ${solutionEntityNames.length} entities in solution(s)`);
      // Merge solution entities with manually specified entities, deduplicate
      const merged = new Set([...this.config.entities, ...solutionEntityNames]);
      this.config.entities = [...merged].sort();
    }

    if (this.config.entities.length === 0) {
      this.logger.warn('No entities to process. Check --entities or --solutions.');
      return {
        entities: [],
        totalFiles: 0,
        totalWarnings: 1,
        durationMs: Date.now() - startTime,
      };
    }

    // 2. Fetch metadata and generate for each entity (parallel, R7-07)
    // DataverseHttpClient already has concurrency control (maxConcurrency),
    // so parallel dispatch here is safe and significantly faster for 5+ entities.
    this.logger.info(`Processing ${this.config.entities.length} entities in parallel`);

    const settled = await Promise.allSettled(
      this.config.entities.map((entityName) => {
        // Skip entities if aborted before they start
        if (signal?.aborted) {
          return Promise.reject(new Error('Generation aborted'));
        }
        return this.processEntity(entityName, metadataClient).then((result) => {
          this.logger.info(`Completed entity: ${entityName} (${result.files.length} files)`);
          return result;
        });
      }),
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

    // 2b. Generate Custom API Action/Function executors
    if (this.config.generateActions && !signal?.aborted) {
      this.logger.info('Fetching Custom APIs...');
      let customApis = await metadataClient.getCustomApis();

      // Apply prefix filter if configured
      if (this.config.actionsFilter) {
        const prefix = this.config.actionsFilter.toLowerCase();
        const before = customApis.length;
        customApis = customApis.filter((api) => api.api.uniquename.toLowerCase().startsWith(prefix));
        this.logger.info(`Filtered Custom APIs by prefix "${this.config.actionsFilter}": ${before} -> ${customApis.length}`);
      }

      if (customApis.length > 0) {
        const importPath = '@xrmforge/typegen';
        const grouped = groupCustomApis(customApis);

        for (const [key, apis] of grouped.actions) {
          const entityName = key === 'global' ? undefined : key;
          const declarations = generateActionDeclarations(apis, false, entityName, { importPath });
          const module = generateActionModule(apis, false, { importPath });

          allFiles.push({
            relativePath: `actions/${key}.d.ts`,
            content: addGeneratedHeader(declarations),
            type: 'action',
          });
          allFiles.push({
            relativePath: `actions/${key}.ts`,
            content: addGeneratedHeader(module),
            type: 'action',
          });
        }

        for (const [key, apis] of grouped.functions) {
          const entityName = key === 'global' ? undefined : key;
          const declarations = generateActionDeclarations(apis, true, entityName, { importPath });
          const module = generateActionModule(apis, true, { importPath });

          allFiles.push({
            relativePath: `functions/${key}.d.ts`,
            content: addGeneratedHeader(declarations),
            type: 'action',
          });
          allFiles.push({
            relativePath: `functions/${key}.ts`,
            content: addGeneratedHeader(module),
            type: 'action',
          });
        }

        this.logger.info(`Generated ${grouped.actions.size} action groups, ${grouped.functions.size} function groups`);
      } else {
        this.logger.info('No Custom APIs found');
      }
    }

    // 3. Write barrel index
    if (allFiles.length > 0) {
      const indexContent = generateBarrelIndex(allFiles);
      const indexFile: GeneratedFile = {
        relativePath: 'index.d.ts',

        content: indexContent,
        type: 'entity',
      };
      allFiles.push(indexFile);
    }

    // 4. Write all files to disk (non-fatal: file write errors become warnings)
    const writeResult = await writeAllFiles(this.config.outputDir, allFiles);

    const durationMs = Date.now() - startTime;
    const entityWarnings = entityResults.reduce((sum, r) => sum + r.warnings.length, 0);
    const totalWarnings = entityWarnings + writeResult.warnings.length;

    for (const w of writeResult.warnings) {
      this.logger.warn(w);
    }

    this.logger.info('Type generation complete', {
      entities: entityResults.length,
      filesWritten: writeResult.written,
      filesUnchanged: writeResult.unchanged,
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
