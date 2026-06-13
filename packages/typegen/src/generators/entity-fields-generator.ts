/**
 * @xrmforge/typegen - Entity Fields Enum Generator
 *
 * Generates a const enum with ALL entity fields for use with Xrm.WebApi.
 * Unlike form-specific Fields enums, this contains every readable attribute.
 *
 * Output pattern (flat ES module):
 * ```typescript
 * export const enum AccountFields {
 *   /** Account Name | Firmenname *\/
 *   Name = 'name',
 *   /** Main Phone | Haupttelefon *\/
 *   Telephone1 = 'telephone1',
 * }
 * ```
 */

import type { EntityTypeInfo } from '../metadata/types.js';
import {
  toPascalCase,
  shouldIncludeInEntityInterface,
  isLookupType,
  toLookupValueProperty,
} from './type-mapping.js';
import {
  formatDualLabel,
  getPrimaryLabel,
  transliterateUmlauts,
  type LabelConfig,
  DEFAULT_LABEL_CONFIG,
} from './label-utils.js';

/** Options for entity fields enum generation */
export interface EntityFieldsGeneratorOptions {
  /** Label configuration for dual-language JSDoc comments */
  labelConfig?: LabelConfig;
}

/** Convert a label to a PascalCase enum member name */
function labelToPascalMember(label: string): string {
  if (!label) return '';
  const transliterated = transliterateUmlauts(label);
  const cleaned = transliterated.replace(/[^a-zA-Z0-9\s_]/g, '');
  const parts = cleaned.split(/[\s_]+/).filter((p) => p.length > 0);
  if (parts.length === 0) return '';
  const pascal = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
  if (/^\d/.test(pascal)) return `_${pascal}`;
  return pascal;
}

/**
 * Generate a const enum with all entity fields for Web API usage.
 * Includes ALL readable fields (not form-specific).
 *
 * @param info - Complete entity metadata
 * @param options - Generator options
 * @returns TypeScript declaration string
 */
export function generateEntityFieldsEnum(
  info: EntityTypeInfo,
  options: EntityFieldsGeneratorOptions = {},
): string {
  const labelConfig = options.labelConfig || DEFAULT_LABEL_CONFIG;
  const entityName = toPascalCase(info.entity.LogicalName);
  const enumName = `${entityName}Fields`;

  // Filter and sort attributes
  const includedAttrs = info.attributes
    .filter(shouldIncludeInEntityInterface)
    .sort((a, b) => a.LogicalName.localeCompare(b.LogicalName));

  const lines: string[] = [];
  lines.push(`/** All fields of ${entityName} (for Web API $select queries) */`);
  lines.push(`export const enum ${enumName} {`);

  const usedNames = new Set<string>();

  for (const attr of includedAttrs) {
    const isLookup = isLookupType(attr.AttributeType);
    const propertyName = isLookup ? toLookupValueProperty(attr.LogicalName) : attr.LogicalName;

    // Build enum member name from label
    const primaryLabel = getPrimaryLabel(attr.DisplayName, labelConfig);
    let memberName = labelToPascalMember(primaryLabel);
    if (!memberName) {
      memberName = toPascalCase(attr.LogicalName);
    }

    // Disambiguate
    const originalName = memberName;
    let counter = 2;
    while (usedNames.has(memberName)) {
      memberName = `${originalName}${counter}`;
      counter++;
    }
    usedNames.add(memberName);

    // Dual-language JSDoc
    const dualLabel = formatDualLabel(attr.DisplayName, labelConfig);
    if (dualLabel) {
      lines.push(`  /** ${dualLabel} */`);
    }
    lines.push(`  ${memberName} = '${propertyName}',`);
  }

  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate a const enum with navigation property names for all lookup fields.
 * Used with parseLookup() and $expand queries.
 *
 * Unlike EntityFields (which uses _fieldname_value format), this enum
 * contains the plain LogicalName (= navigation property name for non-polymorphic lookups).
 *
 * @param info - Complete entity metadata
 * @param options - Generator options
 * @returns TypeScript declaration string
 *
 * @example
 * ```typescript
 * // Generated:
 * const enum AccountNavigationProperties {
 *   Country = 'markant_address1_countryid',
 *   PrimaryContact = 'primarycontactid',
 * }
 *
 * // Usage:
 * parseLookup(response, AccountNav.Country);
 * ```
 */
export function generateEntityNavigationProperties(
  info: EntityTypeInfo,
  options: EntityFieldsGeneratorOptions = {},
): string {
  const labelConfig = options.labelConfig || DEFAULT_LABEL_CONFIG;
  const entityName = toPascalCase(info.entity.LogicalName);
  const enumName = `${entityName}NavigationProperties`;

  // Filter to lookup attributes only
  const lookupAttrs = info.attributes
    .filter(shouldIncludeInEntityInterface)
    .filter((a) => isLookupType(a.AttributeType))
    .sort((a, b) => a.LogicalName.localeCompare(b.LogicalName));

  if (lookupAttrs.length === 0) return '';

  const lines: string[] = [];
  lines.push(`/** Navigation properties of ${entityName} (for parseLookup and $expand) */`);
  lines.push(`export const enum ${enumName} {`);

  const usedNames = new Set<string>();

  for (const attr of lookupAttrs) {
    // Build enum member name from label
    const primaryLabel = getPrimaryLabel(attr.DisplayName, labelConfig);
    let memberName = labelToPascalMember(primaryLabel);
    if (!memberName) {
      memberName = toPascalCase(attr.LogicalName);
    }

    // Disambiguate
    const originalName = memberName;
    let counter = 2;
    while (usedNames.has(memberName)) {
      memberName = `${originalName}${counter}`;
      counter++;
    }
    usedNames.add(memberName);

    // Dual-language JSDoc
    const dualLabel = formatDualLabel(attr.DisplayName, labelConfig);
    if (dualLabel) {
      lines.push(`  /** ${dualLabel} */`);
    }
    // Value = LogicalName (NOT _value format)
    lines.push(`  ${memberName} = '${attr.LogicalName}',`);
  }

  lines.push('}');
  lines.push('');

  return lines.join('\n');
}
