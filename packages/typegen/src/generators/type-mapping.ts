/**
 * @xrmforge/typegen - Type Mapping
 *
 * Maps Dataverse AttributeType values to TypeScript types for:
 * 1. Entity interfaces (Web API data types)
 * 2. Form interfaces (Xrm.Attributes.* types from @types/xrm)
 * 3. Control interfaces (Xrm.Controls.* types from @types/xrm)
 *
 * This is the bridge between Dataverse metadata and generated TypeScript.
 * Goldene Regel 1: All types extend @types/xrm, never replace.
 */

import type { AttributeMetadata } from '../metadata/types.js';
import { createLogger } from '../logger.js';

const log = createLogger('type-mapping');

// ─── Entity Data Types (Web API responses) ───────────────────────────────────

/**
 * Map Dataverse AttributeType to TypeScript type for entity interfaces.
 * These represent the raw data types returned by the Web API.
 *
 * @param attributeType - The AttributeType from Dataverse metadata
 * @param isLookup - Whether this is a lookup field (uses _fieldname_value pattern)
 * @returns TypeScript type string (e.g. "string", "number", "boolean")
 */
export function getEntityPropertyType(attributeType: string, isLookup: boolean = false): string {
  if (isLookup) return 'string'; // GUIDs are strings in Web API

  const mapping = ENTITY_TYPE_MAP[attributeType];
  if (mapping) return mapping;

  log.warn(`Unmapped AttributeType "${attributeType}" falling back to "unknown"`);
  return 'unknown'; // Unmapped types get 'unknown' (safer than 'any')
}

/** Dataverse AttributeType to TypeScript data type */
const ENTITY_TYPE_MAP: Record<string, string> = {
  // String types
  String: 'string',
  Memo: 'string',
  EntityName: 'string',

  // Numeric types
  Integer: 'number',
  BigInt: 'number',
  Decimal: 'number',
  Double: 'number',
  Money: 'number',

  // Boolean
  Boolean: 'boolean',

  // OptionSet types (numeric values in Web API)
  Picklist: 'number',
  State: 'number',
  Status: 'number',
  // MultiSelectPicklist: Web API returns comma-separated string (e.g. "595300000,595300001")
  // Verified live on markant-dev.crm4.dynamics.com 2026-03-29
  MultiSelectPicklist: 'string',

  // Date/Time (ISO 8601 strings in Web API)
  DateTime: 'string',

  // Identifiers
  Uniqueidentifier: 'string',

  // Lookup (handled separately via _value pattern, but base type is string)
  Lookup: 'string',
  Customer: 'string',
  Owner: 'string',
  PartyList: 'string',

  // Binary/Image (not typically in entity interfaces, filtered by shouldIncludeInEntityInterface)
  Virtual: 'unknown',
  CalendarRules: 'unknown',
};

// ─── Form Attribute Types (@types/xrm) ──────────────────────────────────────

/**
 * Map Dataverse AttributeType to Xrm.Attributes.* type for form interfaces.
 * These represent the getAttribute() return types on FormContext.
 *
 * @param attributeType - The AttributeType from Dataverse metadata
 * @returns Fully qualified Xrm attribute type string
 */
export function getFormAttributeType(attributeType: string): string {
  const mapping = FORM_ATTRIBUTE_TYPE_MAP[attributeType];
  if (mapping) return mapping;

  log.warn(`Unmapped form AttributeType "${attributeType}" falling back to generic Attribute`);
  return 'Xrm.Attributes.Attribute'; // Generic fallback
}

/** Dataverse AttributeType to Xrm.Attributes.* type */
const FORM_ATTRIBUTE_TYPE_MAP: Record<string, string> = {
  // String types
  String: 'Xrm.Attributes.StringAttribute',
  Memo: 'Xrm.Attributes.StringAttribute',

  // Numeric types
  Integer: 'Xrm.Attributes.NumberAttribute',
  BigInt: 'Xrm.Attributes.NumberAttribute',
  Decimal: 'Xrm.Attributes.NumberAttribute',
  Double: 'Xrm.Attributes.NumberAttribute',
  Money: 'Xrm.Attributes.NumberAttribute',

  // Boolean
  Boolean: 'Xrm.Attributes.BooleanAttribute',

  // OptionSet types
  Picklist: 'Xrm.Attributes.OptionSetAttribute',
  State: 'Xrm.Attributes.OptionSetAttribute',
  Status: 'Xrm.Attributes.OptionSetAttribute',
  MultiSelectPicklist: 'Xrm.Attributes.MultiSelectOptionSetAttribute',

  // Date/Time
  DateTime: 'Xrm.Attributes.DateAttribute',

  // Lookup types
  Lookup: 'Xrm.Attributes.LookupAttribute',
  Customer: 'Xrm.Attributes.LookupAttribute',
  Owner: 'Xrm.Attributes.LookupAttribute',
  PartyList: 'Xrm.Attributes.LookupAttribute',

  // Entity Name (string attribute in forms)
  EntityName: 'Xrm.Attributes.StringAttribute',
};

// ─── Form Control Types (@types/xrm) ────────────────────────────────────────

/**
 * Map Dataverse AttributeType to Xrm.Controls.* type for form interfaces.
 * These represent the getControl() return types on FormContext.
 *
 * @param attributeType - The AttributeType from Dataverse metadata
 * @returns Fully qualified Xrm control type string
 */
export function getFormControlType(attributeType: string): string {
  const mapping = FORM_CONTROL_TYPE_MAP[attributeType];
  if (mapping) return mapping;

  return 'Xrm.Controls.StandardControl'; // Generic fallback
}

/** Dataverse AttributeType to Xrm.Controls.* type */
const FORM_CONTROL_TYPE_MAP: Record<string, string> = {
  // Standard controls
  String: 'Xrm.Controls.StringControl',
  Memo: 'Xrm.Controls.StringControl',
  Integer: 'Xrm.Controls.NumberControl',
  BigInt: 'Xrm.Controls.NumberControl',
  Decimal: 'Xrm.Controls.NumberControl',
  Double: 'Xrm.Controls.NumberControl',
  Money: 'Xrm.Controls.NumberControl',
  Boolean: 'Xrm.Controls.StandardControl',
  DateTime: 'Xrm.Controls.DateControl',
  EntityName: 'Xrm.Controls.StandardControl',

  // OptionSet controls
  Picklist: 'Xrm.Controls.OptionSetControl',
  State: 'Xrm.Controls.OptionSetControl',
  Status: 'Xrm.Controls.OptionSetControl',
  MultiSelectPicklist: 'Xrm.Controls.MultiSelectOptionSetControl',

  // Lookup controls
  Lookup: 'Xrm.Controls.LookupControl',
  Customer: 'Xrm.Controls.LookupControl',
  Owner: 'Xrm.Controls.LookupControl',
  PartyList: 'Xrm.Controls.LookupControl',
};

// ─── Mock Value Types (for @xrmforge/testing) ──────────────────────────────

/**
 * Map Dataverse AttributeType to JavaScript value type for mock objects.
 * Used by the form generator to create MockValues types for @xrmforge/testing.
 *
 * @param attributeType - The AttributeType from Dataverse metadata
 * @returns TypeScript value type string (e.g. "string | null", "number | null")
 */
export function getFormMockValueType(attributeType: string): string {
  const mapping = FORM_MOCK_VALUE_TYPE_MAP[attributeType];
  if (mapping) return mapping;

  return 'unknown';
}

/** Dataverse AttributeType to JavaScript value type */
const FORM_MOCK_VALUE_TYPE_MAP: Record<string, string> = {
  // String types
  String: 'string | null',
  Memo: 'string | null',
  EntityName: 'string | null',

  // Numeric types
  Integer: 'number | null',
  BigInt: 'number | null',
  Decimal: 'number | null',
  Double: 'number | null',
  Money: 'number | null',

  // Boolean
  Boolean: 'boolean | null',

  // OptionSet types (numeric values at runtime)
  Picklist: 'number | null',
  State: 'number | null',
  Status: 'number | null',
  MultiSelectPicklist: 'number[] | null',

  // Date/Time
  DateTime: 'Date | null',

  // Lookup types
  Lookup: 'Xrm.LookupValue[] | null',
  Customer: 'Xrm.LookupValue[] | null',
  Owner: 'Xrm.LookupValue[] | null',
  PartyList: 'Xrm.LookupValue[] | null',
};

// ─── Identifier Utilities ────────────────────────────────────────────────────

/**
 * Convert a Dataverse LogicalName to a safe TypeScript identifier.
 * Validates that the result is a valid identifier.
 *
 * @param logicalName - Dataverse field or entity logical name
 * @returns A valid TypeScript identifier
 * @throws Never throws; returns the input if already valid, prefixes with _ if starts with digit
 */
export function toSafeIdentifier(logicalName: string): string {
  // Most Dataverse logical names are already valid identifiers
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(logicalName)) {
    return logicalName;
  }

  // Remove invalid characters
  let safe = logicalName.replace(/[^a-zA-Z0-9_$]/g, '_');

  // Ensure it doesn't start with a digit
  if (/^\d/.test(safe)) {
    safe = `_${safe}`;
  }

  // Ensure it's not empty
  if (safe.length === 0) {
    return '_unnamed';
  }

  return safe;
}

/**
 * Convert a Dataverse LogicalName to PascalCase for use as interface/type name.
 *
 * @example
 * toPascalCase('account') // 'Account'
 * toPascalCase('markant_cdhcontactsource') // 'MarkantCdhcontactsource'
 */
export function toPascalCase(logicalName: string): string {
  return logicalName
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// ─── Lookup Field Name Utilities ─────────────────────────────────────────────

/**
 * Convert a lookup attribute LogicalName to its Web API value property name.
 * In the Web API, lookup fields are represented as `_fieldname_value`.
 *
 * @example
 * toLookupValueProperty('primarycontactid') // '_primarycontactid_value'
 * toLookupValueProperty('ownerid') // '_ownerid_value'
 */
export function toLookupValueProperty(logicalName: string): string {
  return `_${logicalName}_value`;
}

/**
 * Determine if an attribute is a single-value lookup type.
 * PartyList is NOT included: it's a collection navigation property (ActivityParty[]),
 * not a single _fieldname_value property in the Web API.
 */
export function isLookupType(attributeType: string): boolean {
  return attributeType === 'Lookup' || attributeType === 'Customer' || attributeType === 'Owner';
}

/**
 * Determine if an attribute is a PartyList (ActivityParty collection).
 * PartyList fields (to, from, cc, bcc, requiredattendees, optionalattendees)
 * are navigation properties in the Web API, not flat lookup properties.
 */
export function isPartyListType(attributeType: string): boolean {
  return attributeType === 'PartyList';
}

/**
 * Determine if an attribute should be included in entity interfaces.
 * Excludes virtual/calculated fields that are not readable via Web API.
 *
 * Filtered types:
 * - Virtual, CalendarRules: not readable via Web API
 * - ManagedProperty: solution metadata (iscustomizable etc.), not business data
 * - EntityName: internal companion fields for lookups; entity type info is only
 *   available via @Microsoft.Dynamics.CRM.lookuplogicalname OData annotation,
 *   not as a standalone property in Web API responses
 */
export function shouldIncludeInEntityInterface(attr: AttributeMetadata): boolean {
  // Exclude virtual attributes (images, file, calculated), but keep MultiSelectPicklist
  // (MultiSelectPicklist has AttributeType "Virtual" but @odata.type distinguishes it)
  if (attr.AttributeType === 'Virtual' || attr.AttributeType === 'CalendarRules') {
    const odataType = (attr as unknown as Record<string, unknown>)['@odata.type'] as string | undefined;
    if (odataType !== '#Microsoft.Dynamics.CRM.MultiSelectPicklistAttributeMetadata') {
      return false;
    }
  }

  // Exclude solution metadata (not business data)
  if (attr.AttributeType === 'ManagedProperty') {
    return false;
  }

  // Exclude EntityName companion fields (e.g. owneridtype, regardingobjectidtype)
  // Entity type info comes from OData annotations, not from these fields
  if (attr.AttributeType === 'EntityName') {
    return false;
  }

  // Exclude attributes that cannot be read
  if (attr.IsValidForRead === false) {
    return false;
  }

  return true;
}
