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

import type { EntityTypeInfo } from '../metadata/types.js';
import {
  toPascalCase,
  toSafeIdentifier,
  shouldIncludeInEntityInterface,
  isLookupType,
  toLookupValueProperty,
} from './type-mapping.js';
import {
  formatDualLabel,
  buildAttributeMemberName,
  type LabelConfig,
  DEFAULT_LABEL_CONFIG,
} from './label-utils.js';
import { createLogger } from '../logger.js';

const log = createLogger('entity-fields-generator');

/** Options for entity fields enum generation */
export interface EntityFieldsGeneratorOptions {
  /** Label configuration for dual-language JSDoc comments */
  labelConfig?: LabelConfig;
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

    // Member name = SchemaName (deterministic, unique, guessable), shared helper (R46-07)
    const memberName = buildAttributeMemberName(attr.SchemaName, attr.LogicalName, usedNames);

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
    // Member name = SchemaName (deterministic, unique, guessable), shared helper (R46-07)
    const memberName = buildAttributeMemberName(attr.SchemaName, attr.LogicalName, usedNames);

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

/**
 * Generate a const enum with target-qualified `$expand` navigation property names for
 * POLYMORPHIC (multi-table) lookups (F-MK9-08-Sub).
 *
 * A polymorphic lookup exposes one single-valued navigation property PER target table,
 * and its name is NOT reliably constructible: `ownerid` resolves to
 * `owninguser`/`owningteam`/`owningbusinessunit`, `regardingobjectid` to
 * `regardingobjectid_account_task`, custom lookups carry the SchemaName casing, etc.
 * Microsoft documents that this case-sensitive value must not be guessed. The
 * authoritative source is `OneToManyRelationshipMetadata.ReferencingEntityNavigationPropertyName`,
 * read here from the entity's N:1 relationships (`info.manyToOneRelationships`).
 *
 * Only polymorphic lookups (`Targets.length > 1`) get members; a single-target lookup
 * keeps using the blank `XxxNavigationProperties` value (which is the navigation
 * property name in those cases). A target whose navigation property name cannot be
 * resolved from the relationship metadata is SKIPPED with a warning - never constructed.
 *
 * Members are named `<LookupSchemaName>_<PascalTarget>` (guessable from lookup + target);
 * the value is the real, case-sensitive navigation property name.
 *
 * @param info - Complete entity metadata
 * @param options - Generator options
 * @returns TypeScript declaration string (empty when no resolvable polymorphic lookup)
 *
 * @example
 * ```typescript
 * // Generated:
 * export const enum SalesOrderExpands {
 *   /** Customer -> account *\/
 *   CustomerId_Account = 'customerid_account',
 *   /** Customer -> contact *\/
 *   CustomerId_Contact = 'customerid_contact',
 * }
 *
 * // Usage (target-qualified name for $expand, read back with the same key):
 * const order = await Xrm.WebApi.retrieveRecord(EntityNames.SalesOrder, id,
 *   selectExpand([SalesOrderFields.Name], `${SalesOrderExpands.CustomerId_Account}($select=${AccountFields.Name})`));
 * const customer = expanded<Account>(order, SalesOrderExpands.CustomerId_Account);
 * ```
 */
export function generateEntityExpands(
  info: EntityTypeInfo,
  options: EntityFieldsGeneratorOptions = {},
): string {
  const labelConfig = options.labelConfig || DEFAULT_LABEL_CONFIG;
  const entityName = toPascalCase(info.entity.LogicalName);
  const enumName = `${entityName}Expands`;

  // Targets per lookup (only lookupAttributes carry Targets)
  const lookupTargets = new Map<string, string[]>();
  for (const la of info.lookupAttributes) {
    if (la.Targets && la.Targets.length > 0) {
      lookupTargets.set(la.LogicalName, la.Targets);
    }
  }

  // Authoritative navigation property name per (lookup logical name, target entity),
  // from the N:1 relationship metadata. NUL-separated key avoids name collisions.
  const navNameByLookupTarget = new Map<string, string>();
  for (const rel of info.manyToOneRelationships ?? []) {
    if (rel.ReferencingAttribute && rel.ReferencedEntity && rel.ReferencingEntityNavigationPropertyName) {
      navNameByLookupTarget.set(`${rel.ReferencingAttribute} ${rel.ReferencedEntity}`, rel.ReferencingEntityNavigationPropertyName);
    }
  }

  // Polymorphic lookups only (Targets.length > 1), in deterministic order. Uses the
  // attributes list for SchemaName/DisplayName/read-filter, joined to Targets by name.
  // Owner lookups are EXCLUDED: verified live on markant-dev, `ownerid` has no
  // `ownerid_<target>` navigation properties - it expands via the separate `owninguser`/
  // `owningteam`/`owningbusinessunit` lookup fields (own ReferencingAttribute), which the
  // blank XxxNavigationProperties enum already covers as single-target lookups. Including
  // Owner here would only emit "unresolvable target" warnings on nearly every entity.
  const polymorphicLookups = info.attributes
    .filter(shouldIncludeInEntityInterface)
    .filter((a) => isLookupType(a.AttributeType) && a.AttributeType !== 'Owner')
    .filter((a) => (lookupTargets.get(a.LogicalName)?.length ?? 0) > 1)
    .sort((a, b) => a.LogicalName.localeCompare(b.LogicalName));

  if (polymorphicLookups.length === 0) return '';

  const body: string[] = [];
  const usedNames = new Set<string>();

  for (const attr of polymorphicLookups) {
    const lookupBase = toSafeIdentifier(attr.SchemaName) || toPascalCase(attr.LogicalName);
    const dualLabel = formatDualLabel(attr.DisplayName, labelConfig);
    // Sort targets for deterministic output (the nav name is matched by relationship, not order)
    const targets = [...(lookupTargets.get(attr.LogicalName) ?? [])].sort((a, b) => a.localeCompare(b));

    for (const target of targets) {
      const navName = navNameByLookupTarget.get(`${attr.LogicalName} ${target}`);
      if (!navName) {
        log.warn(
          `No navigation property name for polymorphic lookup "${attr.LogicalName}" -> "${target}" ` +
            `on "${info.entity.LogicalName}"; skipping (N:1 relationship metadata missing ` +
            `ReferencingEntityNavigationPropertyName). The name must not be guessed.`,
        );
        continue;
      }

      let member = `${lookupBase}_${toPascalCase(target)}`;
      while (usedNames.has(member)) {
        member = `${member}_${toSafeIdentifier(navName)}`;
      }
      usedNames.add(member);

      const jsdoc = dualLabel ? `${dualLabel} -> ${target}` : `-> ${target}`;
      body.push(`  /** ${jsdoc} */`);
      body.push(`  ${member} = '${navName}',`);
    }
  }

  // Every target was unresolvable -> emit nothing (honest: no half-built constants).
  if (body.length === 0) return '';

  const lines: string[] = [];
  lines.push(
    `/** Polymorphic-lookup $expand navigation properties of ${entityName} ` +
      `(target-qualified; single-target lookups use ${entityName}NavigationProperties) */`,
  );
  lines.push(`export const enum ${enumName} {`);
  lines.push(...body);
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}
