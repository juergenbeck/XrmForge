/**
 * @xrmforge/dataverse-core
 *
 * Runtime-neutral core for the Dataverse fetch layer: OData sanitizers, the
 * {@link DataverseTransport} abstraction, and a browser-lean resilient runner.
 * Zero runtime dependencies, so it is safe in both Node and browser bundles.
 *
 * @packageDocumentation
 */

export { sanitizeIdentifier, sanitizeGuid, escapeODataString } from './sanitize.js';
export { ResilientRunner } from './runner.js';
export type { RunnerOptions } from './runner.js';
export type {
  DataverseTransport,
  DataverseRequest,
  DataverseHttpResponse,
} from './transport.js';
export { DataverseError, DataverseHttpError, isDataverseError } from './errors.js';
export type { DataverseErrorCode } from './errors.js';
