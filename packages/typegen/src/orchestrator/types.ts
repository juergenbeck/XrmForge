/**
 * @xrmforge/typegen - Orchestrator Types
 *
 * Configuration and result types for the type generation orchestrator.
 */

import type { LabelConfig } from '../metadata/labels.js';

/** Configuration for the type generation process */
export interface GenerateConfig {
  /** Dataverse environment URL (e.g. "https://myorg.crm4.dynamics.com") */
  environmentUrl: string;

  /** Entity logical names to generate types for (merged with solution entities if both set) */
  entities: string[];

  /** Solution unique names to discover entities automatically (merged with entities, deduplicated) */
  solutionNames?: string[];

  /** Output directory for generated .d.ts files */
  outputDir: string;

  /** Label language configuration */
  labelConfig: LabelConfig;

  /** Whether to generate entity interfaces (default: true) */
  generateEntities?: boolean;

  /** Whether to generate form interfaces (default: true) */
  generateForms?: boolean;

  /** Whether to generate OptionSet enums (default: true) */
  generateOptionSets?: boolean;

  /** Whether to generate Custom API Action/Function executors (default: false) */
  generateActions?: boolean;

  /** Filter Custom APIs by uniquename prefix (e.g. "markant_"). Only APIs matching the prefix are generated. */
  actionsFilter?: string;

  /**
   * Whether to use metadata cache for faster re-generation.
   * When enabled, only changed entities are re-fetched from Dataverse
   * using RetrieveMetadataChanges delta detection.
   * On first run or expired cache, a full refresh is performed automatically.
   * @defaultValue false
   */
  useCache?: boolean;

  /**
   * Directory for metadata cache files.
   * Relative paths are resolved from the current working directory.
   * @defaultValue ".xrmforge/cache"
   */
  cacheDir?: string;

  /** XrmForge namespace prefix (default: "XrmForge") */
  namespacePrefix?: string;
}

/** Result of generating types for a single entity */
export interface EntityGenerationResult {
  /** Entity logical name */
  entityLogicalName: string;

  /** Files written */
  files: GeneratedFile[];

  /** Warnings (e.g. missing labels, empty forms) */
  warnings: string[];
}

/** A single generated file */
export interface GeneratedFile {
  /** Relative path from outputDir */
  relativePath: string;

  /** File content */
  content: string;

  /** Type of generated content */
  type: 'entity' | 'optionset' | 'form' | 'action';
}

/** Statistics about cache usage during generation */
export interface CacheStats {
  /** Whether the cache was used in this run */
  cacheUsed: boolean;
  /** Whether this was a full refresh (no prior cache or expired stamp) */
  fullRefresh: boolean;
  /** Number of entities loaded from cache (unchanged) */
  entitiesFromCache: number;
  /** Number of entities fetched from Dataverse (new or changed) */
  entitiesFetched: number;
  /** Number of entities removed (deleted in Dataverse) */
  entitiesDeleted: number;
}

/** Overall result of the generation process */
export interface GenerationResult {
  /** Per-entity results */
  entities: EntityGenerationResult[];

  /** Total files written */
  totalFiles: number;

  /** Total warnings */
  totalWarnings: number;

  /** Duration in milliseconds */
  durationMs: number;

  /** Cache statistics (present when useCache was enabled) */
  cacheStats?: CacheStats;
}
