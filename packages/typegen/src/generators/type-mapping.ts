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
  MultiSelectPicklist: 'number[]',

  // Date/Time (ISO 8601 strings in Web API)
  DateTime: 'string',

  // Identifiers
  Uniqueidentifier: 'string',

  // Lookup (handled separately via _value pattern, but base type is string)
  Lookup: 'string',
  Customer: 'string',
  Owner: 'string',
  PartyList: 'string',

  // Binary/Image (not typically in entity interfaces)
  Virtual: 'unknown',
  ManagedProperty: 'unknown',
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
  MultiSelectPicklist: 'Xrm.Controls.OptionSetControl',

  // Lookup controls
  Lookup: 'Xrm.Controls.LookupControl',
  Customer: 'Xrm.Controls.LookupControl',
  Owner: 'Xrm.Controls.LookupControl',
  PartyList: 'Xrm.Controls.LookupControl',
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
 * Determine if an attribute is a lookup type.
 */
export function isLookupType(attributeType: string): boolean {
  return attributeType === 'Lookup' || attributeType === 'Customer' || attributeType === 'Owner' || attributeType === 'PartyList';
}

/**
 * Determine if an attribute should be included in entity interfaces.
 * Excludes virtual/calculated fields that are not readable via Web API.
 */
export function shouldIncludeInEntityInterface(attr: AttributeMetadata): boolean {
  // Exclude virtual attributes (images, file, calculated)
  if (attr.AttributeType === 'Virtual' || attr.AttributeType === 'CalendarRules') {
    return false;
  }

  // Exclude attributes that cannot be read
  if (attr.IsValidForRead === false) {
    return false;
  }

  return true;
}
