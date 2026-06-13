/**
 * @xrmforge/typegen - File Writer
 *
 * Writes generated .ts files to disk with proper directory structure:
 *
 * outputDir/
 *   entities/
 *     account.ts
 *     contact.ts
 *   optionsets/
 *     account.ts          (all OptionSets for one entity)
 *   forms/
 *     account.ts          (all form interfaces for one entity)
 *   fields/
 *     account.ts          (FieldsEnum + NavigationProperties)
 *   index.ts              (barrel re-export file)
 */

import { mkdir, writeFile, readFile, unlink, readdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { GeneratedFile, CheckFinding, CheckResult } from './types.js';

/**
 * Normalize line endings to LF before comparing file content.
 *
 * typegen always writes LF, but a checked-in generated file often has CRLF in
 * the working copy: git with `core.autocrlf=true` (the Windows default) checks
 * a LF-stored blob out as CRLF unless a `.gitattributes` forces `eol=lf`.
 * A pure CRLF-vs-LF difference is not drift, so both the write-skip check and
 * `generate --check` normalize line endings first. Without this, `--check`
 * reports every file as `changed` on a normal Windows checkout (false red CI),
 * which would make the drift gate unusable there. Genuine content changes
 * (added/removed lines, reordering, formatter runs) are still detected.
 */
function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n?/g, '\n');
}

/**
 * Write a generated file to disk, creating directories as needed.
 *
 * @param outputDir - Base output directory
 * @param file - Generated file to write
 * @returns true if file was written (content changed), false if unchanged
 */
export async function writeGeneratedFile(outputDir: string, file: GeneratedFile): Promise<boolean> {
  const absolutePath = join(outputDir, file.relativePath);

  // Check if file already exists with same content (avoid unnecessary writes)
  try {
    const existing = await readFile(absolutePath, 'utf-8');
    if (normalizeLineEndings(existing) === normalizeLineEndings(file.content)) {
      return false; // No change (CRLF-only differences are not a change)
    }
  } catch {
    // File doesn't exist yet, proceed with write
  }

  // Ensure directory exists
  await mkdir(dirname(absolutePath), { recursive: true });

  // Write file
  await writeFile(absolutePath, file.content, 'utf-8');

  return true;
}

/** Result of writing a batch of files */
export interface WriteResult {
  /** Number of files successfully written (content changed) */
  written: number;
  /** Number of files unchanged (already up to date) */
  unchanged: number;
  /** Warnings for files that could not be written (non-fatal) */
  warnings: string[];
}

/**
 * Write all generated files to disk.
 * A single file write failure does NOT abort the entire batch.
 * Errors are collected as warnings so the remaining files are still written.
 *
 * @param outputDir - Base output directory
 * @param files - Array of generated files
 * @returns WriteResult with counts and warnings
 */
export async function writeAllFiles(outputDir: string, files: GeneratedFile[]): Promise<WriteResult> {
  const result: WriteResult = { written: 0, unchanged: 0, warnings: [] };

  for (const file of files) {
    try {
      const changed = await writeGeneratedFile(outputDir, file);
      if (changed) {
        result.written++;
      } else {
        result.unchanged++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      result.warnings.push(`Konnte ${file.relativePath} nicht schreiben: ${message}`);
    }
  }

  return result;
}

/**
 * Delete orphaned .ts files for entities that were removed from Dataverse.
 * Removes entity, optionset, and form files for the given entity names.
 *
 * @param outputDir - Base output directory
 * @param deletedEntityNames - Entity logical names whose files should be removed
 * @returns Number of files deleted
 */
export async function deleteOrphanedFiles(outputDir: string, deletedEntityNames: string[]): Promise<number> {
  let deleted = 0;
  const subdirs = ['entities', 'optionsets', 'forms', 'fields'];

  for (const entityName of deletedEntityNames) {
    for (const subdir of subdirs) {
      const filePath = join(outputDir, subdir, `${entityName}.ts`);
      try {
        await unlink(filePath);
        deleted++;
      } catch (error: unknown) {
        // File might not exist (entity had no forms/optionsets), that's fine
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    }
  }

  return deleted;
}

// ─── Drift Check (read-only, no write access) ───────────────────────────────

/** Subdirectories that contain generated files (orphan detection scope) */
const GENERATED_SUBDIRS = ['entities', 'optionsets', 'forms', 'fields', 'actions', 'functions'];

/** Root-level files the generator may produce (orphan detection scope) */
const GENERATED_ROOT_FILES = ['entity-names.ts', 'form-mapping.json', 'index.ts'];

/** Map a relative path to its GeneratedFile category (for orphaned files) */
function typeFromRelativePath(relativePath: string): GeneratedFile['type'] {
  if (relativePath.startsWith('optionsets/')) return 'optionset';
  if (relativePath.startsWith('forms/')) return 'form';
  if (relativePath.startsWith('fields/')) return 'fields';
  if (relativePath.startsWith('actions/') || relativePath.startsWith('functions/')) return 'action';
  return 'entity'; // entities/ and root files (entity-names.ts, form-mapping.json, index.ts)
}

/**
 * Compare a generated file against the file on disk (byte comparison).
 * Read-only: never writes.
 *
 * @returns "unchanged" (identical), "changed" (differs), or "missing" (not on disk)
 * @throws on IO errors other than ENOENT (a check must not mask read errors)
 */
export async function checkGeneratedFile(
  outputDir: string,
  file: GeneratedFile,
): Promise<'unchanged' | 'changed' | 'missing'> {
  const absolutePath = join(outputDir, file.relativePath);
  try {
    const existing = await readFile(absolutePath, 'utf-8');
    return normalizeLineEndings(existing) === normalizeLineEndings(file.content)
      ? 'unchanged'
      : 'changed';
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 'missing';
    }
    throw error;
  }
}

/**
 * Find files on disk that the generator no longer produces (orphans).
 * Scans only the known generated locations (entities/, optionsets/, forms/,
 * fields/, actions/, functions/ plus the known root files), so user files
 * outside these locations are never reported.
 *
 * @param outputDir - Base output directory
 * @param expectedPaths - Relative paths the current generation produces
 * @returns Sorted relative paths of orphaned files
 */
export async function findOrphanedFiles(
  outputDir: string,
  expectedPaths: ReadonlySet<string>,
): Promise<string[]> {
  const orphans: string[] = [];

  for (const subdir of GENERATED_SUBDIRS) {
    let entries;
    try {
      entries = await readdir(join(outputDir, subdir), { withFileTypes: true });
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
      const relativePath = `${subdir}/${entry.name}`;
      if (!expectedPaths.has(relativePath)) {
        orphans.push(relativePath);
      }
    }
  }

  for (const rootFile of GENERATED_ROOT_FILES) {
    if (expectedPaths.has(rootFile)) continue;
    try {
      await access(join(outputDir, rootFile));
      orphans.push(rootFile);
    } catch {
      // Not on disk: nothing to report
    }
  }

  return orphans.sort();
}

/**
 * Run the full drift check: compare every generated file against disk and
 * detect orphaned files. Read-only, never writes.
 *
 * @param outputDir - Base output directory (the checked-in generated files)
 * @param files - Freshly generated files (in-memory)
 */
export async function checkAllFiles(outputDir: string, files: GeneratedFile[]): Promise<CheckResult> {
  const findings: CheckFinding[] = [];
  let unchanged = 0;

  for (const file of files) {
    const status = await checkGeneratedFile(outputDir, file);
    if (status === 'unchanged') {
      unchanged++;
    } else {
      findings.push({ relativePath: file.relativePath, type: file.type, status });
    }
  }

  const expectedPaths = new Set(files.map((f) => f.relativePath));
  const orphans = await findOrphanedFiles(outputDir, expectedPaths);
  for (const relativePath of orphans) {
    findings.push({ relativePath, type: typeFromRelativePath(relativePath), status: 'orphaned' });
  }

  return { drift: findings.length > 0, unchanged, findings };
}

/** File header for generated files */
const GENERATED_HEADER = `// ──────────────────────────────────────────────────────────────────────────────
// This file was generated by @xrmforge/typegen. Do not edit manually.
// Re-run 'xrmforge generate' to update.
// ──────────────────────────────────────────────────────────────────────────────

`;

/**
 * Wrap generated content with the standard header.
 */
export function addGeneratedHeader(content: string): string {
  return GENERATED_HEADER + content;
}

/**
 * Convert a relative .ts path to an ESM import specifier with .js extension.
 * TypeScript ESM convention: import specifiers use .js, resolved to .ts at compile time.
 *
 * @example toImportSpecifier('entities/account.ts') => './entities/account.js'
 */
function toImportSpecifier(relativePath: string): string {
  const withoutExt = relativePath.replace(/\.ts$/, '');
  return `./${withoutExt}.js`;
}

/**
 * Generate a barrel index.ts that re-exports all generated files.
 *
 * @param files - All generated files
 * @returns Content for index.ts
 */
export function generateBarrelIndex(files: GeneratedFile[]): string {
  const lines: string[] = [GENERATED_HEADER];

  // Group by type for organized output
  const entities = files.filter((f) => f.type === 'entity' && !f.relativePath.endsWith('.json'));
  const optionsets = files.filter((f) => f.type === 'optionset');
  const forms = files.filter((f) => f.type === 'form');
  const fields = files.filter((f) => f.type === 'fields');
  const actions = files.filter((f) => f.type === 'action');

  if (entities.length > 0) {
    lines.push('// Entity Interfaces');
    for (const f of entities) {
      lines.push(`export * from '${toImportSpecifier(f.relativePath)}';`);
    }
    lines.push('');
  }

  if (optionsets.length > 0) {
    lines.push('// OptionSet Enums - import directly from individual files to avoid name conflicts:');
    for (const f of optionsets) {
      lines.push(`//   import { ... } from '${toImportSpecifier(f.relativePath)}';`);
    }
    lines.push('');
  }

  if (forms.length > 0) {
    lines.push('// Form Interfaces');
    for (const f of forms) {
      lines.push(`export * from '${toImportSpecifier(f.relativePath)}';`);
    }
    lines.push('');
  }

  if (fields.length > 0) {
    lines.push('// Entity Fields & Navigation Properties - import directly from individual files to avoid name conflicts:');
    for (const f of fields) {
      lines.push(`//   import { ... } from '${toImportSpecifier(f.relativePath)}';`);
    }
    lines.push('');
  }

  if (actions.length > 0) {
    lines.push('// Custom API Actions & Functions');
    for (const f of actions) {
      lines.push(`export * from '${toImportSpecifier(f.relativePath)}';`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
