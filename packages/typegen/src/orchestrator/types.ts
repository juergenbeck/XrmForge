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

  /** Entity logical names to generate types for */
  entities: string[];

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

  /** Whether to use cache (default: true) */
  useCache?: boolean;

  /** Cache directory (default: .xrmforge/cache under outputDir) */
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

  /** Absolute path on disk */
  absolutePath: string;

  /** File content */
  content: string;

  /** Type of generated content */
  type: 'entity' | 'optionset' | 'form';
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
}
