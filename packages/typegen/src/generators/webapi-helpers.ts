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
