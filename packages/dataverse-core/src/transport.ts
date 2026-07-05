/**
 * @xrmforge/dataverse-core - Transport abstraction
 *
 * Separates "authenticate, build the URL, perform exactly one fetch" (the
 * transport) from the resilience runner. Browser and Node adapters implement
 * DataverseTransport; the runner only ever sees this interface, so the same
 * retry/backoff logic works cookie-based (browser) or bearer-based (Node).
 */

/** A single Dataverse Web API request (exactly one round-trip). */
export interface DataverseRequest {
  /** HTTP method. */
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Absolute request URL (already resolved via {@link DataverseTransport.resolveUrl}). */
  url: string;
  /** Additional request headers, merged onto the transport's own defaults. */
  headers?: Record<string, string>;
  /** Serialized request body (JSON string) for write operations. */
  body?: string;
  /** Abort signal for cancellation and timeout. */
  signal?: AbortSignal;
}

/**
 * A transport-agnostic response view. Deliberately minimal so that a test
 * `FakeTransport` can implement it without constructing a real `Response`.
 */
export interface DataverseHttpResponse {
  /** HTTP status code. */
  status: number;
  /** True for a 2xx status. */
  ok: boolean;
  /** Read a response header by (case-insensitive) name; `null` when absent. */
  getHeader(name: string): string | null;
  /** The raw response body as text. */
  text(): Promise<string>;
}

/**
 * Performs authentication, URL resolution, and exactly one HTTP round-trip.
 *
 * Implementations MUST NOT retry (resilience is the runner's job) and MUST
 * resolve, not reject, for non-2xx HTTP responses. They should reject only for
 * network-level failures or aborts.
 */
export interface DataverseTransport {
  /**
   * Resolve an API-relative path (e.g. `"accounts?$select=name"`) to an absolute
   * URL against this transport's Dataverse base. An already-absolute URL (such as
   * an `@odata.nextLink`) is returned unchanged.
   */
  resolveUrl(path: string): string;

  /** Execute exactly one round-trip. No retry. */
  send(request: DataverseRequest): Promise<DataverseHttpResponse>;
}
