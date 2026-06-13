/**
 * @xrmforge/typegen - Entity Names Enum Generator
 *
 * Generates a single const enum with all entity logical names.
 * Eliminates raw strings in Xrm.WebApi calls.
 *
 * Output pattern (flat ES module):
 * ```typescript
 * export const enum EntityNames {
 *   Account = 'account',
 *   Contact = 'contact',
 *   Lead = 'lead',
 * }
 * ```
 */

import { toPascalCase } from './type-mapping.js';

/** Options for entity names enum generation (reserved for future use) */
export type EntityNamesGeneratorOptions = Record<string, never>;

/**
 * Generate a const enum mapping entity PascalCase names to logical names.
 *
 * @param entityNames - Array of entity logical names
 * @param options - Generator options
 * @returns TypeScript declaration string
 */
export function generateEntityNamesEnum(
  entityNames: string[],
  _options: EntityNamesGeneratorOptions = {},
): string {
  const sorted = [...entityNames].sort();

  const lines: string[] = [];
  lines.push('/** Entity logical names for Xrm.WebApi calls (compile-time only, zero runtime) */');
  lines.push('export const enum EntityNames {');

  for (const name of sorted) {
    const pascal = toPascalCase(name);
    lines.push(`  ${pascal} = '${name}',`);
  }

  lines.push('}');
  lines.push('');

  return lines.join('\n');
}
