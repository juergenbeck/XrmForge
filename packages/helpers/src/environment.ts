/**
 * @xrmforge/helpers - Environment variable reader
 *
 * Read Dataverse environment variables (definition + current value) from form
 * scripts, with in-memory caching for the form session. Typically used by
 * cloud-flow integrations to load Flow URLs without hardcoding (F-MK8-N4a).
 *
 * The definition entity (`environmentvariabledefinition`) and the 1:N relationship
 * to its values (`environmentvariabledefinition_environmentvariablevalue`) are fixed
 * Dataverse system names, so they are hardwired here (typegen only emits Lookup
 * navigation properties, not 1:N collection navs).
 */

const cache = new Map<string, string | null>();

/**
 * Clear the in-memory environment-variable cache.
 *
 * Useful in tests (call between cases) or to force a re-read after a value changed
 * during the form session.
 */
export function clearEnvironmentVariableCache(): void {
  cache.clear();
}

/**
 * Read a Dataverse environment variable by schema name.
 *
 * Returns the current value if one is set, otherwise the definition's default
 * value, otherwise `null` (definition not found or no value anywhere). Results are
 * cached per schema name for the form session; repeated reads hit the cache.
 *
 * WebApi errors are NOT swallowed: they propagate to the caller (the handler wrapper
 * owns the error UI). A missing definition is a normal `null`, not an error.
 *
 * @param schemaName - The environment variable's schema name (e.g. 'new_FlowUrl')
 * @returns The resolved value, or null if not found / empty
 *
 * @example
 * ```typescript
 * import { getEnvironmentVariable, callCloudFlow } from '@xrmforge/helpers';
 * const url = await getEnvironmentVariable(Constants.VerifyFlowUrlSchemaName);
 * if (url) await callCloudFlow(url, payload);
 * ```
 */
export async function getEnvironmentVariable(schemaName: string): Promise<string | null> {
  if (cache.has(schemaName)) return cache.get(schemaName) ?? null;

  // Escape single quotes for the OData string literal (defense-in-depth, Goldene Regel 7).
  const safe = schemaName.replace(/'/g, "''");
  const query =
    `?$select=defaultvalue&$filter=schemaname eq '${safe}'` +
    `&$expand=environmentvariabledefinition_environmentvariablevalue($select=value)&$top=1`;

  const result = await Xrm.WebApi.retrieveMultipleRecords('environmentvariabledefinition', query);

  let value: string | null = null;
  const def = result.entities[0] as
    | {
        defaultvalue?: string | null;
        environmentvariabledefinition_environmentvariablevalue?: { value?: string | null }[];
      }
    | undefined;
  if (def) {
    const values = def.environmentvariabledefinition_environmentvariablevalue;
    const current = Array.isArray(values) && values.length > 0 ? values[0]?.value : undefined;
    if (current != null && current !== '') {
      value = current;
    } else if (def.defaultvalue != null && def.defaultvalue !== '') {
      value = def.defaultvalue;
    }
  }

  cache.set(schemaName, value);
  return value;
}
