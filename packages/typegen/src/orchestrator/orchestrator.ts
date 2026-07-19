/**
 * @xrmforge/typegen - Type Generation Orchestrator
 *
 * Coordinates the full type generation pipeline:
 * 1. Fetch metadata for requested entities (via MetadataClient)
 * 2. Generate entity interfaces, OptionSet enums, form interfaces, fields enums
 * 3. Write .ts files to disk
 *
 * This is the main entry point that ties all components together.
 */

import type { TokenCredential } from '@azure/identity';
import { MetadataClient } from '../metadata/client.js';
import { MetadataCache } from '../metadata/cache.js';
import { ChangeDetector } from '../metadata/change-detector.js';
import { DataverseHttpClient } from '../http/client.js';
import { ErrorCode } from '../errors.js';
import { createLogger, type Logger } from '../logger.js';
import type { EntityTypeInfo, OptionSetMetadata } from '../metadata/types.js';
import { generateEntityInterface } from '../generators/entity-generator.js';
import { generateEntityOptionSets } from '../generators/optionset-generator.js';
import { generateEntityForms, type FormGenerationMeta } from '../generators/form-generator.js';
import { generateActionModule, groupCustomApis } from '../generators/action-generator.js';
import { generateEntityFieldsEnum, generateEntityNavigationProperties, generateEntityExpands, generateEntityFieldKinds } from '../generators/entity-fields-generator.js';
import { generateEntityNamesEnum } from '../generators/entity-names-generator.js';
import { generateActivityPartyInterface } from '../generators/activity-party.js';
import { isPartyListType } from '../generators/type-mapping.js';
import { addGeneratedHeader, writeAllFiles, generateBarrelIndex, deleteOrphanedFiles, checkAllFiles } from './file-writer.js';
import type {
  GenerateConfig,
  GenerationResult,
  EntityGenerationResult,
  GeneratedFile,
  CacheStats,
  CheckResult,
} from './types.js';

/**
 * Main orchestrator for type generation.
 *
 * Usage:
 * ```typescript
 * const orchestrator = new TypeGenerationOrchestrator(credential, {
 *   environmentUrl: 'https://myorg.crm4.dynamics.com',
 *   entities: ['account', 'contact'],
 *   outputDir: './generated',
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
      entities: [...config.entities],
      solutionNames: config.solutionNames ?? [],
      outputDir: config.outputDir,
      labelConfig: config.labelConfig,
      generateEntities: config.generateEntities ?? true,
      generateForms: config.generateForms ?? true,
      generateOptionSets: config.generateOptionSets ?? true,
      generateActions: config.generateActions ?? false,
      actionsFilter: config.actionsFilter ?? '',
      generateFieldKinds: config.generateFieldKinds ?? false,
      useCache: config.useCache ?? false,
      cacheDir: config.cacheDir ?? '.xrmforge/cache',
      namespacePrefix: config.namespacePrefix ?? 'XrmForge',
      checkOnly: config.checkOnly ?? false,
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

    // Check mode is strictly read-only and always runs against live metadata:
    // a stale local cache would mask exactly the drift the check should find.
    const checkOnly = this.config.checkOnly;
    const useCache = this.config.useCache && !checkOnly;
    if (this.config.useCache && checkOnly) {
      this.logger.warn('Check mode ignores the metadata cache (drift check must run against live metadata)');
    }

    this.logger.info(checkOnly ? 'Starting drift check (read-only)' : 'Starting type generation', {
      entities: this.config.entities,
      outputDir: this.config.outputDir,
      useCache,
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

    // 2. Determine cache strategy
    let cacheStats: CacheStats | undefined;
    const entitiesToFetch = new Set<string>(this.config.entities);
    const cachedEntityInfos: Record<string, EntityTypeInfo> = {};
    let cache: MetadataCache | undefined;
    let newVersionStamp: string | null = null;
    const deletedEntityNames: string[] = [];

    if (useCache) {
      const cacheResult = await this.resolveCache(httpClient, entitiesToFetch);
      cache = cacheResult.cache;
      newVersionStamp = cacheResult.newVersionStamp;
      cacheStats = cacheResult.stats;

      // Move cached entities out of the fetch set
      for (const [name, info] of Object.entries(cacheResult.cachedEntities)) {
        cachedEntityInfos[name] = info;
        entitiesToFetch.delete(name);
      }
      deletedEntityNames.push(...cacheResult.deletedEntityNames);
    }

    // 3. Fetch metadata for entities that need fetching (parallel, R7-07)
    const fetchList = [...entitiesToFetch];
    const failedEntities = new Map<string, string>(); // entityName -> errorMsg
    if (fetchList.length > 0) {
      this.logger.info(`Fetching ${fetchList.length} entities from Dataverse`);

      const settled = await Promise.allSettled(
        fetchList.map((entityName) => {
          if (signal?.aborted) {
            return Promise.reject(new Error('Generation aborted'));
          }
          return metadataClient.getEntityTypeInfo(entityName).then((info) => {
            this.logger.info(`Fetched entity: ${entityName}`);
            return { entityName, info };
          });
        }),
      );

      for (let i = 0; i < settled.length; i++) {
        const outcome = settled[i]!;
        const entityName = fetchList[i]!;

        if (outcome.status === 'fulfilled') {
          cachedEntityInfos[outcome.value.entityName] = outcome.value.info;
        } else {
          const errorMsg = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
          this.logger.error(`Failed to fetch entity: ${entityName}`, { error: outcome.reason });
          failedEntities.set(entityName, errorMsg);
        }
      }
    }

    // 3b. Generate ActivityParty interface if any entity has PartyList attributes
    if (this.config.generateEntities) {
      const hasPartyList = Object.values(cachedEntityInfos).some((info) =>
        info.attributes.some((a) => isPartyListType(a.AttributeType)),
      );
      if (hasPartyList) {
        const activityPartyContent = generateActivityPartyInterface();
        allFiles.push({
          relativePath: 'entities/_activity-party.ts',
          content: addGeneratedHeader(activityPartyContent),
          type: 'entity',
        });
      }
    }

    // 3c. Generate types for all entities in order (cached + freshly fetched)
    this.logger.info(`Generating types for ${this.config.entities.length - failedEntities.size} entities`);

    for (const entityName of this.config.entities) {
      if (signal?.aborted) break;

      // Check if fetch failed for this entity
      if (failedEntities.has(entityName)) {
        entityResults.push({
          entityLogicalName: entityName,
          files: [],
          warnings: [`Failed to process: ${failedEntities.get(entityName)}`],
          formMeta: [],
        });
        continue;
      }

      const entityInfo = cachedEntityInfos[entityName];
      if (!entityInfo) continue; // Should not happen, but safety guard

      const result = this.generateEntityFiles(entityName, entityInfo);
      this.logger.info(`Generated entity: ${entityName} (${result.files.length} files)`);
      entityResults.push(result);
      allFiles.push(...result.files);
    }

    // 3d. Generate Custom API Action/Function executors
    if (this.config.generateActions && !signal?.aborted) {
      const actionFiles = await this.generateActions(metadataClient);
      allFiles.push(...actionFiles);
    }

    // 3e. Generate EntityNames enum (all entities in one file)
    if (this.config.entities.length > 0) {
      const entityNamesContent = generateEntityNamesEnum(this.config.entities);
      allFiles.push({
        relativePath: 'entity-names.ts',
        content: addGeneratedHeader(entityNamesContent),
        type: 'entity',
      });
    }

    // 3f. Generate form-mapping.json (AI agent helper: entity -> form interfaces,
    // their fields and a main-form marker). Built from the structured per-form
    // metadata collected during generation (F-MAR7-04), not by parsing the generated code.
    const entityFormMeta = entityResults
      .filter((r) => r.formMeta.length > 0)
      .map((r) => ({ entityName: r.entityLogicalName, forms: r.formMeta }));
    if (entityFormMeta.length > 0) {
      const formMapping = this.generateFormMapping(entityFormMeta);
      allFiles.push({
        relativePath: 'form-mapping.json',
        content: JSON.stringify(formMapping, null, 2) + '\n',
        type: 'entity',
      });
      // Slim companion index (OE-22): the same forms WITHOUT the large per-form
      // `fields` arrays, for a fast interface/main-form lookup that does not need
      // to load every field set.
      const formIndex = this.generateFormIndex(entityFormMeta);
      allFiles.push({
        relativePath: 'form-index.json',
        content: JSON.stringify(formIndex, null, 2) + '\n',
        type: 'entity',
      });
    }

    // 4. Write barrel index
    if (allFiles.length > 0) {
      const indexContent = generateBarrelIndex(allFiles);
      const indexFile: GeneratedFile = {
        relativePath: 'index.ts',
        content: indexContent,
        type: 'entity',
      };
      allFiles.push(indexFile);
    }

    // 5. Check mode: compare against disk (read-only). Otherwise: write to disk.
    let checkResult: CheckResult | undefined;
    let writeResult = { written: 0, unchanged: 0, warnings: [] as string[] };

    if (checkOnly) {
      // Only meaningful when the generation is complete: a partial run
      // (fetch failures, abort) would report misleading missing/orphaned files.
      if (failedEntities.size === 0 && !signal?.aborted) {
        checkResult = await checkAllFiles(this.config.outputDir, allFiles);
        this.logger.info(
          checkResult.drift
            ? `Drift detected: ${checkResult.findings.length} finding(s), ${checkResult.unchanged} files unchanged`
            : `No drift: ${checkResult.unchanged} files unchanged`,
        );
      } else {
        this.logger.warn('Drift check skipped: generation incomplete (fetch failures or abort)');
      }
    } else {
      // Write all files to disk (non-fatal: file write errors become warnings)
      writeResult = await writeAllFiles(this.config.outputDir, allFiles);

      // 5b. Delete orphaned .ts files for deleted entities
      if (deletedEntityNames.length > 0) {
        const deleted = await deleteOrphanedFiles(this.config.outputDir, deletedEntityNames);
        if (deleted > 0) {
          this.logger.info(`Deleted ${deleted} orphaned files for removed entities`);
        }
      }

      // 6. Update cache with new data
      if (useCache && cache) {
        await this.updateCache(cache, cachedEntityInfos, deletedEntityNames, newVersionStamp);
      }
    }

    const durationMs = Date.now() - startTime;
    const entityWarnings = entityResults.reduce((sum, r) => sum + r.warnings.length, 0);
    const totalWarnings = entityWarnings + writeResult.warnings.length;

    for (const w of writeResult.warnings) {
      this.logger.warn(w);
    }

    this.logger.info(checkOnly ? 'Drift check complete' : 'Type generation complete', {
      entities: entityResults.length,
      filesWritten: writeResult.written,
      filesUnchanged: writeResult.unchanged,
      totalFiles: allFiles.length,
      totalWarnings,
      durationMs,
      cacheUsed: cacheStats?.cacheUsed ?? false,
    });

    return {
      entities: entityResults,
      totalFiles: allFiles.length,
      totalWarnings,
      durationMs,
      cacheStats,
      checkResult,
    };
  }

  /**
   * Resolve the cache: load existing cache, detect changes, determine which
   * entities need to be fetched vs. can be served from cache.
   *
   * On any failure (corrupt cache, expired stamp), falls back to full refresh.
   */
  private async resolveCache(
    httpClient: DataverseHttpClient,
    requestedEntities: Set<string>,
  ): Promise<{
    cache: MetadataCache;
    cachedEntities: Record<string, EntityTypeInfo>;
    deletedEntityNames: string[];
    newVersionStamp: string | null;
    stats: CacheStats;
  }> {
    const cache = new MetadataCache(this.config.cacheDir);
    const changeDetector = new ChangeDetector(httpClient);

    // Try to load existing cache
    let cacheData;
    try {
      cacheData = await cache.load(this.config.environmentUrl);
    } catch {
      this.logger.warn('Failed to load metadata cache, performing full refresh');
      cacheData = null;
    }

    if (!cacheData || !cacheData.manifest.serverVersionStamp) {
      // No cache or no stamp: full refresh, but get initial stamp for next run
      this.logger.info('No valid cache found, performing full metadata refresh');
      const stamp = await changeDetector.getInitialVersionStamp();
      return {
        cache,
        cachedEntities: {},
        deletedEntityNames: [],
        newVersionStamp: stamp,
        stats: {
          cacheUsed: true,
          fullRefresh: true,
          entitiesFromCache: 0,
          entitiesFetched: requestedEntities.size,
          entitiesDeleted: 0,
        },
      };
    }

    // Cache exists with stamp: try delta detection
    let changeResult;
    try {
      changeResult = await changeDetector.detectChanges(cacheData.manifest.serverVersionStamp);
    } catch (error: unknown) {
      // Expired stamp or other error: fall back to full refresh
      const isExpired = error instanceof Error &&
        error.message.includes(ErrorCode.META_VERSION_STAMP_EXPIRED);
      if (isExpired) {
        this.logger.warn('Cache version stamp expired (>90 days), performing full refresh');
      } else {
        this.logger.warn('Change detection failed, performing full refresh', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      const stamp = await changeDetector.getInitialVersionStamp();
      return {
        cache,
        cachedEntities: {},
        deletedEntityNames: [],
        newVersionStamp: stamp,
        stats: {
          cacheUsed: true,
          fullRefresh: true,
          entitiesFromCache: 0,
          entitiesFetched: requestedEntities.size,
          entitiesDeleted: 0,
        },
      };
    }

    // Delta detection succeeded: determine which entities to fetch
    const changedSet = new Set(changeResult.changedEntityNames);
    const cachedEntities: Record<string, EntityTypeInfo> = {};
    let entitiesFromCache = 0;
    let entitiesFetched = 0;

    for (const entityName of requestedEntities) {
      if (changedSet.has(entityName) || !cacheData.entityTypeInfos[entityName]) {
        // Entity changed or not in cache: needs fresh fetch
        entitiesFetched++;
      } else {
        // Entity unchanged and in cache: use cached version
        cachedEntities[entityName] = cacheData.entityTypeInfos[entityName]!;
        entitiesFromCache++;
      }
    }

    // Deleted entities that were in our entity list
    const deletedEntityNames = changeResult.deletedEntityNames.filter(
      (name) => requestedEntities.has(name),
    );

    this.logger.info(`Cache delta: ${entitiesFromCache} from cache, ${entitiesFetched} to fetch, ${deletedEntityNames.length} deleted`);

    return {
      cache,
      cachedEntities,
      deletedEntityNames,
      newVersionStamp: changeResult.newVersionStamp,
      stats: {
        cacheUsed: true,
        fullRefresh: false,
        entitiesFromCache,
        entitiesFetched,
        entitiesDeleted: deletedEntityNames.length,
      },
    };
  }

  /**
   * Update the metadata cache after a successful generation run.
   */
  private async updateCache(
    cache: MetadataCache,
    entityTypeInfos: Record<string, EntityTypeInfo>,
    deletedEntityNames: string[],
    newVersionStamp: string | null,
  ): Promise<void> {
    try {
      if (deletedEntityNames.length > 0) {
        await cache.removeEntities(this.config.environmentUrl, deletedEntityNames, newVersionStamp);
      }
      await cache.save(this.config.environmentUrl, entityTypeInfos, newVersionStamp);
      this.logger.info('Metadata cache updated');
    } catch (error: unknown) {
      // Cache update failure is non-fatal
      this.logger.warn('Failed to update metadata cache', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Generate all output files for a single entity from its metadata.
   */
  private generateEntityFiles(
    entityName: string,
    entityInfo: EntityTypeInfo,
  ): EntityGenerationResult {
    const warnings: string[] = [];
    const files: GeneratedFile[] = [];
    const formMeta: FormGenerationMeta[] = [];

    // Generate entity interface
    if (this.config.generateEntities) {
      const entityContent = generateEntityInterface(entityInfo, {
        labelConfig: this.config.labelConfig,
      });
      files.push({
        relativePath: `entities/${entityName}.ts`,
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
        });

        if (optionSets.length > 0) {
          // Combine all OptionSets for one entity into a single file
          const combinedContent = optionSets.map((os) => os.content).join('\n');
          files.push({
            relativePath: `optionsets/${entityName}.ts`,
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
          },
        );

        if (formResults.length > 0) {
          // Combine all forms for one entity into a single file
          const combinedContent = formResults.map((f) => f.content).join('\n');
          files.push({
            relativePath: `forms/${entityName}.ts`,
            content: addGeneratedHeader(combinedContent),
            type: 'form',
          });
          // Surface per-form metadata (fields, isMain, enum names) for form-mapping.json
          for (const { content: _content, ...meta } of formResults) {
            formMeta.push(meta);
          }
        }
      } else {
        warnings.push(`No forms found for ${entityName}`);
      }
    }

    // Generate entity fields enum and navigation properties (R4-03)
    if (this.config.generateEntities) {
      const fieldsEnumContent = generateEntityFieldsEnum(entityInfo, {
        labelConfig: this.config.labelConfig,
      });
      const navPropsContent = generateEntityNavigationProperties(entityInfo, {
        labelConfig: this.config.labelConfig,
      });
      const expandsContent = generateEntityExpands(entityInfo, {
        labelConfig: this.config.labelConfig,
      });
      // XxxFieldKinds is opt-in (OE-18): it lists every field of the entity and is only
      // needed for single-entity-multi-form typedFields scripts, which are rare. Default off
      // keeps the output lean; cross-entity typedFields use hand-written kindMaps.
      const fieldKindsContent = this.config.generateFieldKinds ? generateEntityFieldKinds(entityInfo) : '';

      // Combine outputs into a single file. navProps is empty when there are no
      // lookups; expands is empty when there are no (resolvable) polymorphic lookups;
      // fieldKinds is empty unless generateFieldKinds is enabled (opt-in).
      const combinedFieldsContent = [fieldsEnumContent, navPropsContent, expandsContent, fieldKindsContent]
        .filter((part) => part)
        .join('\n');

      files.push({
        relativePath: `fields/${entityName}.ts`,
        content: addGeneratedHeader(combinedFieldsContent),
        type: 'fields',
      });
    }

    return { entityLogicalName: entityName, files, warnings, formMeta };
  }

  /**
   * Generate Custom API Action/Function executor files.
   */
  private async generateActions(metadataClient: MetadataClient): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

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
      const importPath = '@xrmforge/helpers';
      const grouped = groupCustomApis(customApis);

      for (const [key, apis] of grouped.actions) {
        const module = generateActionModule(apis, false, { importPath });

        files.push({
          relativePath: `actions/${key}.ts`,
          content: addGeneratedHeader(module),
          type: 'action',
        });
      }

      for (const [key, apis] of grouped.functions) {
        const module = generateActionModule(apis, true, { importPath });

        files.push({
          relativePath: `functions/${key}.ts`,
          content: addGeneratedHeader(module),
          type: 'action',
        });
      }

      this.logger.info(`Generated ${grouped.actions.size} action groups, ${grouped.functions.size} function groups`);
    } else {
      this.logger.info('No Custom APIs found');
    }

    return files;
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

    // Also include MultiSelect Picklist attributes (F-MK9-09): their OptionSet
    // is fetched separately because they are a distinct metadata type.
    // Guard with ?? [] for metadata cached by an older typegen version.
    for (const attr of entityInfo.multiSelectPicklistAttributes ?? []) {
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

  /**
   * Generate a form-mapping.json that maps each entity to its generated forms:
   * interface name, Fields/Tabs enum names, a main-form marker (isMain), and the
   * list of fields each form binds to. This lets AI agents pick the right form by
   * its fields without guessing interface names.
   *
   * Built from the structured per-form metadata collected during generation
   * (F-MAR7-04), not by parsing the generated code.
   */
  private generateFormMapping(
    entityForms: Array<{ entityName: string; forms: FormGenerationMeta[] }>,
  ): Record<string, Array<{ formName: string; interface: string; fieldsEnum: string; tabsEnum: string; isMain: boolean; fields: string[] }>> {
    const mapping: Record<string, Array<{ formName: string; interface: string; fieldsEnum: string; tabsEnum: string; isMain: boolean; fields: string[] }>> = {};

    for (const { entityName, forms } of entityForms) {
      if (forms.length === 0) continue;
      mapping[entityName] = forms.map((f) => ({
        formName: f.formName,
        interface: f.interfaceName,
        fieldsEnum: f.fieldsEnumName,
        tabsEnum: f.tabsEnumName,
        isMain: f.isMain,
        fields: f.fields,
      }));
    }

    return mapping;
  }

  /**
   * Generate a slim form-index.json: the same per-entity form list as
   * form-mapping.json but WITHOUT the (large) per-form `fields` arrays. This is
   * the fast-lookup companion (OE-22): an agent that only needs interface names,
   * enum names and the main-form marker loads a few KB instead of the full
   * mapping (which can be hundreds of KB once every field set is listed). The
   * `fields` stay in form-mapping.json for the rarer "which form binds field X?"
   * question. Built from the same FormGenerationMeta, so the two never drift.
   */
  private generateFormIndex(
    entityForms: Array<{ entityName: string; forms: FormGenerationMeta[] }>,
  ): Record<string, Array<{ formName: string; interface: string; fieldsEnum: string; tabsEnum: string; isMain: boolean }>> {
    const index: Record<string, Array<{ formName: string; interface: string; fieldsEnum: string; tabsEnum: string; isMain: boolean }>> = {};

    for (const { entityName, forms } of entityForms) {
      if (forms.length === 0) continue;
      index[entityName] = forms.map((f) => ({
        formName: f.formName,
        interface: f.interfaceName,
        fieldsEnum: f.fieldsEnumName,
        tabsEnum: f.tabsEnumName,
        isMain: f.isMain,
      }));
    }

    return index;
  }
}
