/**
 * @xrmforge/webapi
 *
 * Type-safe Xrm.WebApi client with query builder for Dynamics 365.
 *
 * @packageDocumentation
 */

export { webApi, retrieve, retrieveMultiple, create, update, remove } from './client.js';
export { QueryBuilder, createQuery, query } from './query-builder.js';
export { WebApiError } from './error.js';
