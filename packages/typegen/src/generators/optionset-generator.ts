/**
 * @xrmforge/typegen - OptionSet Enum Generator
 *
 * Generates TypeScript const enums from Dataverse OptionSet metadata.
 * Uses const enum because D365 form scripts have no module system at runtime,
 * so enum values must be inlined at compile time.
 *
 * Output pattern:
 * ```typescript
 * declare namespace XrmForge.OptionSets {
 *   const enum AccountCategoryCode {
 *     PreferredCustomer = 1,
 *     Standard = 2,
 *   }
 * }
 * ```
 */

import type { OptionSetMetadata } from '../metadata/types.js';
import {
  formatDualLabel,
  getPrimaryLabel,
  labelToEnumMember,
  disambiguateEnumMembers,
  type LabelConfig,
  DEFAULT_LABEL_CONFIG,
} from './label-utils.js';
import { toPascalCase } from './type-mapping.js';

/** Options for OptionSet enum generation */
export interface OptionSetGeneratorOptions {
  /** Label configuration for dual-language JSDoc comments */
  labelConfig?: LabelConfig;
}

/**
 * Generate a TypeScript const enum declaration from an OptionSet.
 *
 * @param optionSet - OptionSet metadata from Dataverse
 * @param entityLogicalName - Entity this OptionSet belongs to (for naming local OptionSets)
 * @param attributeSchemaName - Attribute schema name (for naming local OptionSets)
 * @param options - Generator options
 * @returns TypeScript const enum declaration string
 */
export function generateOptionSetEnum(
  optionSet: OptionSetMetadata,
  _entityLogicalName: string,
  attributeSchemaName: string,
  options: OptionSetGeneratorOptions = {},
): string {
  const labelConfig = options.labelConfig || DEFAULT_LABEL_CONFIG;

  // Determine enum name
  const enumName = optionSet.IsGlobal
    ? toPascalCase(optionSet.Name)
    : toPascalCase(attributeSchemaName);

  // Build members from options
  const rawMembers = optionSet.Options.map((opt) => {
    const label = getPrimaryLabel(opt.Label, labelConfig);
    const memberName = labelToEnumMember(label);
    return {
      name: memberName || `Value_${opt.Value}`, // Fallback for empty/invalid labels
      value: opt.Value,
      option: opt,
    };
  });

  // Disambiguate duplicate member names
  const disambiguated = disambiguateEnumMembers(
    rawMembers.map((m) => ({ name: m.name, value: m.value })),
  );

  const lines: string[] = [];

  // Enum JSDoc
  const enumLabel = formatDualLabel(optionSet.DisplayName, labelConfig);
  if (enumLabel) {
    lines.push(`/** ${enumLabel} (${optionSet.Name}) */`);
  }

  lines.push(`export const enum ${enumName} {`);

  // Members
  for (let i = 0; i < disambiguated.length; i++) {
    const member = disambiguated[i]!;
    const rawMember = rawMembers[i];
    if (!rawMember) continue;

    // JSDoc with original label (always show, even if member name was derived from it)
    const memberLabel = formatDualLabel(rawMember.option.Label, labelConfig);
    if (memberLabel) {
      lines.push(`  /** ${memberLabel} */`);
    }

    lines.push(`  ${member.name} = ${member.value},`);
  }

  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate multiple OptionSet enums for all picklist attributes of an entity.
 * Handles both local and global OptionSets.
 *
 * @param picklistAttributes - Picklist attributes with their OptionSet metadata
 * @param entityLogicalName - Entity logical name
 * @param options - Generator options
 * @returns Array of { enumName, content } for each generated enum
 */
export function generateEntityOptionSets(
  picklistAttributes: Array<{ SchemaName: string; OptionSet: OptionSetMetadata | null; GlobalOptionSet: OptionSetMetadata | null }>,
  entityLogicalName: string,
  options: OptionSetGeneratorOptions = {},
): Array<{ enumName: string; content: string }> {
  const results: Array<{ enumName: string; content: string }> = [];
  const generatedGlobals = new Set<string>();

  for (const attr of picklistAttributes) {
    const optionSet = attr.OptionSet || attr.GlobalOptionSet;
    if (!optionSet || !optionSet.Options || optionSet.Options.length === 0) continue;

    // Skip global OptionSets that were already generated
    if (optionSet.IsGlobal && generatedGlobals.has(optionSet.Name)) continue;
    if (optionSet.IsGlobal) generatedGlobals.add(optionSet.Name);

    const enumName = optionSet.IsGlobal
      ? toPascalCase(optionSet.Name)
      : toPascalCase(attr.SchemaName);

    const content = generateOptionSetEnum(optionSet, entityLogicalName, attr.SchemaName, options);
    results.push({ enumName, content });
  }

  return results;
}
