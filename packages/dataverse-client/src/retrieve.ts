/**
 * @xrmforge/dataverse-client - retrieveAll
 *
 * Retrieve every record of an entity set by following `@odata.nextLink` across
 * pages, with a safety cap. Read-only (GET). Built on the core resilient runner.
 */

import {
  ResilientRunner,
  sanitizeIdentifier,
  type DataverseTransport,
  type RunnerOptions,
} from '@xrmforge/dataverse-core';
import { BrowserTransport } from './browser-transport.js';

/** Default page-follow safety cap (matches the Node typegen client's getAll). */
const DEFAULT_MAX_PAGES = 100;

/** Shape of an OData collection response page. */
interface ODataPage<T> {
  value: T[];
  '@odata.nextLink'?: string;
}

/** Options for {@link retrieveAll}. */
export interface RetrieveAllOptions {
  /**
   * Maximum pages to follow via `@odata.nextLink`. Default 100 (a safety cap
   * against runaway paging; each page holds up to 5000 records). Set higher, or
   * `Infinity`, when a genuinely larger result set is expected.
   */
  maxPages?: number;
  /** Abort signal that cancels the whole (possibly multi-page) retrieval. */
  signal?: AbortSignal;
  /**
   * Transport to use. Defaults to a cookie-based {@link BrowserTransport}. Inject
   * a fake transport in tests to avoid a real fetch.
   */
  transport?: DataverseTransport;
  /** Resilience tuning forwarded to the runner (retries, backoff, timeout). */
  runner?: RunnerOptions;
  /**
   * Called when the `maxPages` cap stops paging before the final page, so a
   * silent truncation is observable. Receives the pages and records retrieved
   * so far.
   */
  onMaxPagesReached?: (info: { pages: number; records: number }) => void;
}

/**
 * Retrieve all records of an entity set, following `@odata.nextLink` across pages.
 *
 * @typeParam T - The record shape (e.g. a generated entity interface).
 * @param entitySetName - The entity **set** name (plural, e.g. `"accounts"`) used
 *   as the REST path segment. NOTE: this differs from `webapi.retrieveMultiple`,
 *   which takes the singular logical name (`"account"`).
 * @param odataQuery - Optional OData query string, with or without a leading `"?"`
 *   (e.g. `"$select=name&$filter=statecode eq 0"`).
 * @param options - Paging, cancellation, transport, and resilience options.
 * @returns All records across all fetched pages (bounded by `maxPages`).
 * @throws {DataverseError} on an invalid entity set name, abort, or HTTP failure.
 */
export async function retrieveAll<T>(
  entitySetName: string,
  odataQuery?: string,
  options?: RetrieveAllOptions,
): Promise<T[]> {
  sanitizeIdentifier(entitySetName);

  const transport = options?.transport ?? new BrowserTransport();
  const runner = new ResilientRunner(transport, options?.runner);
  const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
  const signal = options?.signal;

  const query = odataQuery ? odataQuery.replace(/^\?/, '') : '';
  const firstPath = query ? `${entitySetName}?${query}` : entitySetName;

  const all: T[] = [];
  let url: string | null = transport.resolveUrl(firstPath);
  let page = 0;

  while (url) {
    if (page >= maxPages) {
      options?.onMaxPagesReached?.({ pages: page, records: all.length });
      break;
    }
    page++;
    // Explicit annotation: breaks the inference cycle (response uses url in the
    // request, url is reassigned from response below) and is honest that the
    // runner yields undefined for an empty / 204 body.
    const response: ODataPage<T> | undefined = await runner.send<ODataPage<T>>({
      method: 'GET',
      url,
      signal,
    });
    if (response?.value) {
      all.push(...response.value);
    }
    url = response?.['@odata.nextLink'] ?? null;
  }

  return all;
}
