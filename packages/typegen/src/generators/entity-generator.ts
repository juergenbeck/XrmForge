/**
 * @xrmforge/typegen - Entity Interface Generator
 *
 * Generates TypeScript declaration files (.d.ts) for Dataverse entity interfaces.
 * These interfaces represent the data types returned by the Web API.
 *
 * Output pattern:
 * ```typescript
 * declare namespace XrmForge.Entities {
 *   interface Account {
 *     accountid: string | null;
 *     name: string | null;
 *     // ...
 *   }
 * }
 * ```
 */

import type { EntityTypeInfo } from '../metadata/types.js';
import {
  getEntityPropertyType,
  isLookupType,
  isPartyListType,
  toLookupValueProperty,
  shouldIncludeInEntityInterface,
  toPascalCase,
} from './type-mapping.js';
import { formatDualLabel, type LabelConfig, DEFAULT_LABEL_CONFIG } from './label-utils.js';

/** Options for entity interface generation */
export interface EntityGeneratorOptions {
  /** Label configuration for dual-language JSDoc comments */
  labelConfig?: LabelConfig;
}

/**
 * Generate a TypeScript declaration for an entity interface.
 *
 * @param info - Complete entity metadata (from MetadataClient.getEntityTypeInfo)
 * @param options - Generator options
 * @returns TypeScript declaration string (.d.ts content)
 */
export function generateEntityInterface(info: EntityTypeInfo, options: EntityGeneratorOptions = {}): string {
  const labelConfig = options.labelConfig || DEFAULT_LABEL_CONFIG;
  const entityName = toPascalCase(info.entity.LogicalName);
  const entityLabel = formatDualLabel(info.entity.DisplayName, labelConfig);

  const lines: string[] = [];

  // Check if ActivityParty import is needed (entity has PartyList fields)
  const partyListAttrs = info.attributes.filter((a) => isPartyListType(a.AttributeType));
  if (partyListAttrs.length > 0) {
    lines.push("import type { ActivityParty } from './_activity-party.js';");
    lines.push('');
  }

  // Entity JSDoc
  if (entityLabel) {
    lines.push(`/** ${entityLabel} */`);
  }
  lines.push(`export interface ${entityName} {`);

  // Filter and sort attributes
  const includedAttrs = info.attributes
    .filter(shouldIncludeInEntityInterface)
    .sort((a, b) => a.LogicalName.localeCompare(b.LogicalName));

  // Build lookup map for target info in JSDoc
  const lookupTargets = new Map<string, string[]>();
  for (const la of info.lookupAttributes) {
    if (la.Targets && la.Targets.length > 0) {
      lookupTargets.set(la.LogicalName, la.Targets);
    }
  }

  for (const attr of includedAttrs) {
    const isLookup = isLookupType(attr.AttributeType);
    const propertyName = isLookup ? toLookupValueProperty(attr.LogicalName) : attr.LogicalName;
    const tsType = getEntityPropertyType(attr.AttributeType, isLookup);

    // Build JSDoc
    const label = formatDualLabel(attr.DisplayName, labelConfig);
    const jsdocParts: string[] = [];
    if (label) jsdocParts.push(label);

    // Add lookup target info
    if (isLookup) {
      const targets = lookupTargets.get(attr.LogicalName);
      if (targets && targets.length > 0) {
        jsdocParts.push(`Lookup (${targets.join(' | ')})`);
      }
    }

    // Add read-only marker
    if (!attr.IsValidForCreate && !attr.IsValidForUpdate && !attr.IsPrimaryId) {
      jsdocParts.push('read-only');
    }

    if (jsdocParts.length > 0) {
      lines.push(`  /** ${jsdocParts.join(' - ')} */`);
    }

    // Primary ID is never null in a WebApi response (the record wouldn't exist without it)
    const nullable = attr.IsPrimaryId ? '' : ' | null';
    lines.push(`  ${propertyName}: ${tsType}${nullable};`);
  }

  // PartyList: single navigation property for the entity's ActivityParty collection.
  // Multiple PartyList fields (to, from, cc, bcc, requiredattendees) share ONE
  // navigation property per entity (e.g. email_activity_parties).
  if (partyListAttrs.length > 0) {
    // Find the activity party relationship (there's typically one per activity entity)
    const relationship = info.oneToManyRelationships.find(
      (r) => r.ReferencingEntity === 'activityparty',
    );
    const navPropName = relationship
      ? relationship.SchemaName.charAt(0).toLowerCase() + relationship.SchemaName.slice(1)
      : `${info.entity.LogicalName}_activity_parties`;

    lines.push('');
    lines.push(`  /** ActivityParty collection (${partyListAttrs.length} PartyList-Felder: ${partyListAttrs.map((a) => a.LogicalName).join(', ')}) */`);
    lines.push(`  ${navPropName}: ActivityParty[] | null;`);
  }

  lines.push('}');
  lines.push('');

  return lines.join('\n');
}
