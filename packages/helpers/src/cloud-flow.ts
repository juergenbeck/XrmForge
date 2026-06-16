/**
 * @xrmforge/helpers - Power Automate Cloud Flow caller
 *
 * Browser-safe, typed wrapper around a Power Automate cloud flow triggered by an
 * HTTP request ("When an HTTP request is received"). Replaces the hand-written
 * fetch wrappers that legacy D365 form scripts use for cloud-flow calls.
 *
 * The trigger URL contains a SAS signature and is environment-specific: pass it in
 * as a parameter (e.g. read from configuration), never hard-code it in source.
 * Custom API / Dataverse-proxied calls are a different concern and are covered by
 * `createUnboundAction`; this helper is for the direct HTTP-trigger case. Because
 * the call runs in the browser, the flow's CORS settings must allow the Dynamics
 * origin.
 *
 * Zero Node.js dependencies (uses the global `fetch`). For a progress spinner,
 * compose with `withProgress`: `withProgress('...', () => callCloudFlow(url, body))`.
 *
 * @example
 * ```typescript
 * import { callCloudFlow } from '@xrmforge/helpers';
 *
 * interface PriceRequest { quoteId: string; }
 * interface PriceResponse { total: number; currency: string; }
 *
 * // FLOW_URL comes from configuration, never hard-coded in source.
 * const price = await callCloudFlow<PriceRequest, PriceResponse>(
 *   FLOW_URL,
 *   { quoteId },
 * );
 * console.log(price.total, price.currency);
 * ```
 */

/** Options for {@link callCloudFlow}. */
export interface CloudFlowOptions {
  /** HTTP method (default `'POST'`; HTTP-trigger flows are usually POST). */
  method?: string;
  /** Extra request headers, merged over the defaults (the caller's values win). */
  headers?: Record<string, string>;
  /** AbortSignal to cancel the request (e.g. a timeout or form unload). */
  signal?: AbortSignal;
}

/**
 * Call a Power Automate cloud flow via its HTTP request trigger URL.
 *
 * Sends `body` as JSON for methods that carry a body (anything but GET/HEAD), and
 * returns the parsed response: parsed JSON when the flow responds with
 * `application/json`, the raw text for other content types, or `undefined` for an
 * empty / `204 No Content` response. Throws on any non-2xx HTTP status, with the
 * status code and the response body included in the error message.
 *
 * @typeParam TReq - Shape of the request body.
 * @typeParam TRes - Shape of the parsed response.
 * @param triggerUrl - The flow's HTTP trigger URL (contains a SAS signature; pass
 *   from configuration, never hard-code it).
 * @param body - Request payload, JSON-serialized when present.
 * @param options - Optional HTTP method, extra headers, and abort signal.
 * @returns The parsed flow response.
 * @throws {Error} If the flow responds with a non-2xx status.
 */
export async function callCloudFlow<TReq = unknown, TRes = unknown>(
  triggerUrl: string,
  body?: TReq,
  options: CloudFlowOptions = {},
): Promise<TRes> {
  const method = options.method ?? 'POST';
  const hasBody = body !== undefined && method !== 'GET' && method !== 'HEAD';

  const headers: Record<string, string> = {};
  if (hasBody) headers['Content-Type'] = 'application/json';
  if (options.headers) Object.assign(headers, options.headers);

  const response = await fetch(triggerUrl, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined,
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Cloud flow call failed (HTTP ${response.status} ${response.statusText})` +
      (errorText ? `: ${errorText}` : ''),
    );
  }

  if (response.status === 204) {
    return undefined as TRes;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as TRes;
  }
  const text = await response.text();
  return (text === '' ? undefined : text) as TRes;
}
