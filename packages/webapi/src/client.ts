/**
 * @xrmforge/webapi - Type-safe Web API Client
 *
 * Wraps Xrm.WebApi with generic return types and structured error handling.
 * Uses the generated entity interfaces as return types.
 *
 * @example
 * ```typescript
 * import { webApi, query } from '@xrmforge/webapi';
 * import type { Account } from './generated/entities/account';
 *
 * const account = await webApi.retrieve<Account>('account', id,
 *   query.select('name', 'address1_city')
 * );
 * // account.name is string | null (not unknown)
 * ```
 */

import type { QueryBuilder } from './query-builder.js';
import { WebApiError } from './error.js';

/**
 * Retrieve a single record by entity name and ID.
 *
 * @typeParam T - Generated entity interface (e.g. Account, Contact)
 * @param entityName - Entity logical name (e.g. 'account')
 * @param id - Record GUID
 * @param queryOrString - QueryBuilder instance or raw OData query string
 * @returns The record typed as T
 * @throws {WebApiError} on API failure
 */
export async function retrieve<T>(
  entityName: string,
  id: string,
  queryOrString?: QueryBuilder | string,
): Promise<T> {
  const queryStr = resolveQuery(queryOrString);
  try {
    const result = await Xrm.WebApi.retrieveRecord(entityName, id, queryStr);
    return result as unknown as T;
  } catch (error) {
    throw WebApiError.fromXrmError(error);
  }
}

/**
 * Retrieve multiple records with optional query.
 *
 * @typeParam T - Generated entity interface
 * @param entityName - Entity logical name
 * @param queryOrString - QueryBuilder instance or raw OData query string
 * @returns Array of records typed as T
 * @throws {WebApiError} on API failure
 */
export async function retrieveMultiple<T>(
  entityName: string,
  queryOrString?: QueryBuilder | string,
): Promise<T[]> {
  const queryStr = resolveQuery(queryOrString);
  try {
    const result = await Xrm.WebApi.retrieveMultipleRecords(entityName, queryStr);
    return result.entities as unknown as T[];
  } catch (error) {
    throw WebApiError.fromXrmError(error);
  }
}

/**
 * Create a new record.
 *
 * @param entityName - Entity logical name
 * @param data - Record data (field name to value mapping)
 * @returns The ID of the created record
 * @throws {WebApiError} on API failure
 */
export async function create(
  entityName: string,
  data: Record<string, unknown>,
): Promise<string> {
  try {
    const result = await Xrm.WebApi.createRecord(entityName, data);
    return result.id;
  } catch (error) {
    throw WebApiError.fromXrmError(error);
  }
}

/**
 * Update an existing record.
 *
 * @param entityName - Entity logical name
 * @param id - Record GUID
 * @param data - Fields to update (field name to value mapping)
 * @throws {WebApiError} on API failure
 */
export async function update(
  entityName: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    await Xrm.WebApi.updateRecord(entityName, id, data);
  } catch (error) {
    throw WebApiError.fromXrmError(error);
  }
}

/**
 * Delete a record.
 *
 * @param entityName - Entity logical name
 * @param id - Record GUID
 * @throws {WebApiError} on API failure
 */
export async function remove(
  entityName: string,
  id: string,
): Promise<void> {
  try {
    await Xrm.WebApi.deleteRecord(entityName, id);
  } catch (error) {
    throw WebApiError.fromXrmError(error);
  }
}

/** Resolve a QueryBuilder or string to a query string */
function resolveQuery(queryOrString?: QueryBuilder | string): string {
  if (!queryOrString) return '';
  if (typeof queryOrString === 'string') return queryOrString;
  return queryOrString.build();
}

/** Convenience namespace for all CRUD operations */
export const webApi = {
  retrieve,
  retrieveMultiple,
  create,
  update,
  remove,
};
