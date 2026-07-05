/**
 * @xrmforge/dataverse-client
 *
 * Browser-first Dataverse Web API client: a cookie-based fetch transport plus
 * `retrieveAll` for `@odata.nextLink` paging, built on `@xrmforge/dataverse-core`.
 *
 * @packageDocumentation
 */

export { retrieveAll } from './retrieve.js';
export type { RetrieveAllOptions } from './retrieve.js';
export { BrowserTransport } from './browser-transport.js';
export type { BrowserTransportOptions } from './browser-transport.js';

// Re-export the core surface so consumers can sanitize input and catch errors
// without importing @xrmforge/dataverse-core directly.
export {
  DataverseError,
  DataverseHttpError,
  isDataverseError,
  sanitizeIdentifier,
  sanitizeGuid,
  escapeODataString,
} from '@xrmforge/dataverse-core';
export type {
  DataverseErrorCode,
  DataverseTransport,
  DataverseRequest,
  DataverseHttpResponse,
  RunnerOptions,
} from '@xrmforge/dataverse-core';
