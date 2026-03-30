/**
 * @xrmforge/typegen - Web API Helper Functions
 *
 * Lightweight utility functions for building OData query strings
 * with type-safe field names from generated Fields enums.
 *
 * Zero runtime overhead when used with const enums (values are inlined).
 *
 * @example
 * ```typescript
 * import { select } from '@xrmforge/typegen';
 *
 * Xrm.WebApi.retrieveRecord(ref.entityType, ref.id, select(
 *   AccountFields.Name,
 *   AccountFields.WebsiteUrl,
 *   AccountFields.Address1Line1,
 * ));
 * ```
 */

/**
 * Build an OData $select query string from field names.
 *
 * @param fields - Field names (use generated Fields enum for type safety)
 * @returns OData query string (e.g. "?$select=name,websiteurl,address1_line1")
 */
export function select(...fields: string[]): string {
  if (fields.length === 0) return '';
  return `?$select=${fields.join(',')}`;
}

/**
 * Parse a lookup field from a Dataverse Web API response into a LookupValue.
 *
 * Dataverse returns lookups as `_fieldname_value` with OData annotations:
 * - `_fieldname_value` (GUID)
 * - `_fieldname_value@OData.Community.Display.V1.FormattedValue` (display name)
 * - `_fieldname_value@Microsoft.Dynamics.CRM.lookuplogicalname` (entity type)
 *
 * This function extracts all three into an `Xrm.LookupValue` object.
 *
 * @param response - The raw Web API response object
 * @param fieldOrKey - Navigation property name ("parentaccountid") or EntityFields enum value ("_parentaccountid_value")
 * @returns Xrm.LookupValue or null if the lookup is empty
 *
 * @example
 * ```typescript
 * // Mit Navigation Property Name:
 * parseLookup(result, 'markant_address1_countryid');
 *
 * // Mit EntityFields-Enum (empfohlen, keine Raw-Strings):
 * parseLookup(result, AccountFields.Country);  // '_markant_address1_countryid_value'
 * ```
 */
export function parseLookup(
  response: Record<string, unknown>,
  fieldOrKey: string,
): { id: string; name: string; entityType: string } | null {
  // Accept both formats: 'parentaccountid' or '_parentaccountid_value' (from EntityFields enum)
  const key = fieldOrKey.startsWith('_') && fieldOrKey.endsWith('_value')
    ? fieldOrKey
    : `_${fieldOrKey}_value`;
  const id = response[key] as string | undefined;
  if (!id) return null;

  return {
    id,
    name: (response[`${key}@OData.Community.Display.V1.FormattedValue`] as string) ?? '',
    entityType: (response[`${key}@Microsoft.Dynamics.CRM.lookuplogicalname`] as string) ?? '',
  };
}

/**
 * Parse multiple lookup fields from a Dataverse Web API response at once.
 *
 * @param response - The raw Web API response object
 * @param navigationProperties - Navigation property names to parse
 * @returns Map of navigation property name to LookupValue (null entries omitted)
 *
 * @example
 * ```typescript
 * const lookups = parseLookups(result, ['markant_address1_countryid', 'parentaccountid']);
 * formContext.getAttribute(Fields.Country).setValue(
 *   lookups.markant_address1_countryid ? [lookups.markant_address1_countryid] : null
 * );
 * ```
 */
export function parseLookups(
  response: Record<string, unknown>,
  navigationProperties: string[],
): Record<string, { id: string; name: string; entityType: string } | null> {
  const result: Record<string, { id: string; name: string; entityType: string } | null> = {};
  for (const prop of navigationProperties) {
    result[prop] = parseLookup(response, prop);
  }
  return result;
}

/**
 * Get the formatted (display) value of any field from a Web API response.
 *
 * Works for OptionSets, Lookups, DateTimes, Money, and other formatted fields.
 *
 * @param response - The raw Web API response object
 * @param fieldName - The field logical name (e.g. "statecode", "createdon")
 * @returns The formatted string value, or null if not available
 *
 * @example
 * ```typescript
 * const status = parseFormattedValue(result, 'statecode');
 * // "Active" (statt 0)
 * ```
 */
export function parseFormattedValue(
  response: Record<string, unknown>,
  fieldName: string,
): string | null {
  return (response[`${fieldName}@OData.Community.Display.V1.FormattedValue`] as string) ?? null;
}

/**
 * Build an OData $select and $expand query string.
 *
 * @param fields - Field names to select
 * @param expand - Navigation property to expand (optional)
 * @returns OData query string
 *
 * @example
 * ```typescript
 * Xrm.WebApi.retrieveRecord("account", id, selectExpand(
 *   [AccountFields.Name, AccountFields.WebsiteUrl],
 *   "primarycontactid($select=fullname,emailaddress1)"
 * ));
 * ```
 */
export function selectExpand(fields: string[], expand: string): string {
  const parts: string[] = [];
  if (fields.length > 0) parts.push(`$select=${fields.join(',')}`);
  if (expand) parts.push(`$expand=${expand}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}
