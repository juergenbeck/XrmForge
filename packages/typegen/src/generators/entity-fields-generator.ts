/**
 * @xrmforge/typegen - Entity Fields Enum Generator
 *
 * Generates a const enum with ALL entity fields for use with Xrm.WebApi.
 * Unlike form-specific Fields enums, this contains every readable attribute.
 *
 * Member naming (F-MK9-05/07, Option A): enum members are named after the
 * attribute SchemaName (the cased form of the LogicalName), NOT the display
 * label. SchemaNames are unique per entity (Dataverse guarantee), so naming is
 * deterministic, collision-free and guessable from the LogicalName - the same
 * scheme pac modelbuilder and XrmDefinitelyTyped use. The display label stays in
 * the dual-language JSDoc comment (IDE tooltip). This avoids the order-dependent
 * ordinal disambiguation (F-MK9-05) and the unguessable label members (F-MK9-07)
 * of the previous label-based naming.
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

import type { AttributeMetadata, EntityTypeInfo } from '../metadata/types.js';
import {
  toPascalCase,
  toSafeIdentifier,
  shouldIncludeInEntityInterface,
  isLookupType,
  toLookupValueProperty,
} from './type-mapping.js';
import {
  formatDualLabel,
  type LabelConfig,
  DEFAULT_LABEL_CONFIG,
} from './label-utils.js';

/** Options for entity fields enum generation */
export interface EntityFieldsGeneratorOptions {
  /** Label configuration for dual-language JSDoc comments */
  labelConfig?: LabelConfig;
}

/**
 * Build the enum member name for an attribute from its SchemaName.
 *
 * SchemaNames are valid identifiers and unique per entity, so this is
 * deterministic and collision-free. Falls back to a PascalCased LogicalName
 * only if the SchemaName is missing (defensive; should not happen with real
 * metadata).
 */
function attributeMemberName(attr: AttributeMetadata): string {
  const fromSchema = attr.SchemaName ? toSafeIdentifier(attr.SchemaName) : '';
  return fromSchema || toPascalCase(attr.LogicalName);
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

    // Member name = SchemaName (deterministic, unique, guessable)
    let memberName = attributeMemberName(attr);

    // Defensive deterministic guard. SchemaNames are unique per entity, so this
    // never fires in practice; if it ever did, the LogicalName (also unique)
    // makes the member unambiguous without an order-dependent ordinal.
    while (usedNames.has(memberName)) {
      memberName = `${memberName}_${toSafeIdentifier(attr.LogicalName)}`;
    }
    usedNames.add(memberName);

    // Dual-language JSDoc carries the human-readable label (IDE tooltip)
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
 * Members are named after the SchemaName (same scheme as EntityFields).
 *
 * @param info - Complete entity metadata
 * @param options - Generator options
 * @returns TypeScript declaration string
 *
 * @example
 * ```typescript
 * // Generated:
 * const enum AccountNavigationProperties {
 *   Markant_Address1_CountryId = 'markant_address1_countryid',
 *   PrimaryContactId = 'primarycontactid',
 * }
 *
 * // Usage:
 * parseLookup(response, AccountNav.PrimaryContactId);
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
    // Member name = SchemaName (deterministic, unique, guessable)
    let memberName = attributeMemberName(attr);

    // Defensive deterministic guard (see generateEntityFieldsEnum)
    while (usedNames.has(memberName)) {
      memberName = `${memberName}_${toSafeIdentifier(attr.LogicalName)}`;
    }
    usedNames.add(memberName);

    // Dual-language JSDoc carries the human-readable label (IDE tooltip)
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
