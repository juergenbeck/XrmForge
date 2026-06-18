/**
 * @xrmforge/helpers - Web API Helper Functions
 *
 * Lightweight utility functions for building OData query strings
 * with type-safe field names from generated Fields enums.
 *
 * Zero runtime overhead when used with const enums (values are inlined).
 *
 * @example
 * ```typescript
 * import { select } from '@xrmforge/helpers';
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
 * Accepts either variadic arguments or a single array:
 * - `select(Fields.Name, Fields.Email)` (variadic)
 * - `select([Fields.Name, Fields.Email])` (array)
 *
 * @param fields - Field names (use generated Fields enum for type safety)
 * @returns OData query string (e.g. "?$select=name,websiteurl,address1_line1")
 */
export function select(fields: string[]): string;
export function select(...fields: string[]): string;
export function select(...args: string[] | [string[]]): string {
  const fields = args.length === 1 && Array.isArray(args[0]) ? args[0] : args as string[];
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
 * @param navigationProperty - Navigation property name (use NavigationProperties enum for type safety)
 * @returns Xrm.LookupValue or null if the lookup is empty
 *
 * @example
 * ```typescript
 * // With NavigationProperties enum (recommended):
 * parseLookup(result, AccountNav.Country);
 *
 * // Or with navigation property name directly:
 * parseLookup(result, 'markant_address1_countryid');
 * ```
 */
export function parseLookup(
  response: Record<string, unknown>,
  navigationProperty: string,
): { id: string; name: string; entityType: string } | null {
  const key = `_${navigationProperty}_value`;
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
 * // "Active" (instead of 0)
 * ```
 */
export function parseFormattedValue(
  response: Record<string, unknown>,
  fieldName: string,
): string | null {
  return (response[`${fieldName}@OData.Community.Display.V1.FormattedValue`] as string) ?? null;
}

/**
 * Parse a MultiSelect OptionSet value into a number array.
 *
 * MultiSelect OptionSets come back in different shapes: the Web API returns a
 * comma-separated string (`"595300000,595300001"`), a form attribute returns a
 * `number[]`. This normalizes all shapes (comma string, number[], single number,
 * null/undefined) to a clean `number[]` (empty/whitespace parts dropped).
 *
 * @param value - The raw value (comma string, number[], number, or null)
 * @param emptyAsNull - When `true`, an empty result yields `null` instead of `[]`
 *   (handy for `setValue`, which treats `null` as "clear")
 * @returns The parsed option values
 *
 * @example
 * // Web API response -> number[] for comparison:
 * const types = parseMultiSelect(account.markant_customertypemulticode);
 * if (types.includes(CustomerType.Industry)) { ... }
 *
 * // Writing back to a form field (empty -> null clears it):
 * form.markant_customertypemulticode.setValue(parseMultiSelect(raw, true));
 */
export function parseMultiSelect(value: unknown): number[];
export function parseMultiSelect(value: unknown, emptyAsNull: false): number[];
export function parseMultiSelect(value: unknown, emptyAsNull: true): number[] | null;
export function parseMultiSelect(value: unknown, emptyAsNull = false): number[] | null {
  let nums: number[];
  if (value == null) {
    nums = [];
  } else if (Array.isArray(value)) {
    nums = value.map((v) => Number(v)).filter(Number.isFinite);
  } else if (typeof value === 'number') {
    nums = [value];
  } else if (typeof value === 'string') {
    // Drop empty parts BEFORE Number(): Number('') is 0, not NaN, which would
    // otherwise sneak a spurious 0 in from a trailing comma.
    nums = value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '')
      .map(Number)
      .filter(Number.isFinite);
  } else {
    nums = [];
  }
  return nums.length === 0 && emptyAsNull ? null : nums;
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

// ─── Form Lookup Helpers ────────────────────────────────────────────────────

/**
 * Extract the first lookup value from a FormContext lookup attribute.
 *
 * Centralizes the common pattern of reading a lookup from a form field,
 * handling null/empty arrays, and normalizing the GUID (removing braces).
 *
 * @param attr - A lookup attribute from formContext.getAttribute()
 * @returns Xrm.LookupValue with normalized id (no braces), or null if empty
 *
 * @example
 * ```typescript
 * import { formLookup } from '@xrmforge/helpers';
 * const customer = formLookup(form.getAttribute(Fields.CustomerId));
 * if (customer) {
 *   console.log(customer.id, customer.name, customer.entityType);
 * }
 * ```
 */
export function formLookup(
  attr: { getValue(): { id: string; name?: string; entityType: string }[] | null },
): { id: string; name: string; entityType: string } | null {
  const values = attr.getValue();
  if (!values || values.length === 0) return null;
  const first = values[0]!;
  return {
    id: first.id.replace(/[{}]/g, ''),
    name: first.name ?? '',
    entityType: first.entityType,
  };
}

/**
 * Extract just the normalized GUID from a FormContext lookup attribute.
 *
 * Shorthand for the most common lookup use case: getting the record ID
 * for a Web API call or comparison.
 *
 * @param attr - A lookup attribute from formContext.getAttribute()
 * @returns Normalized GUID string (no braces), or null if empty
 *
 * @example
 * ```typescript
 * import { formLookupId } from '@xrmforge/helpers';
 * const accountId = formLookupId(form.getAttribute(Fields.AccountId));
 * if (accountId) {
 *   await Xrm.WebApi.retrieveRecord(EntityNames.Account, accountId, select(...));
 * }
 * ```
 */
export function formLookupId(
  attr: { getValue(): { id: string }[] | null },
): string | null {
  const values = attr.getValue();
  if (!values || values.length === 0) return null;
  return values[0]!.id.replace(/[{}]/g, '');
}
