/**
 * @xrmforge/dataverse-client - Browser transport
 *
 * A cookie-based {@link DataverseTransport} for model-driven-app web resources
 * and form scripts. It reads the client URL from Xrm and authenticates with
 * `credentials: "include"` (no bearer token), verified against a live Dataverse
 * org (2026-07-05): a same-origin GET returns 200, `credentials: "omit"` returns
 * 401, and a cross-origin (foreign-origin) request is blocked by CORS. This
 * transport therefore targets same-origin web resources served under the org URL.
 */

import type {
  DataverseHttpResponse,
  DataverseRequest,
  DataverseTransport,
} from '@xrmforge/dataverse-core';

/** Options for {@link BrowserTransport}. */
export interface BrowserTransportOptions {
  /** Web API version path segment. Default `"v9.2"`. */
  apiVersion?: string;
  /**
   * Override the Dataverse client URL. When omitted it is read lazily from
   * `Xrm.Utility.getGlobalContext().getClientUrl()`, so constructing this
   * transport never touches Xrm until the first request.
   */
  clientUrl?: string;
}

/** Cookie-authenticated fetch transport for the Dataverse Web API in the browser. */
export class BrowserTransport implements DataverseTransport {
  private readonly apiVersion: string;
  private readonly clientUrlOverride: string | undefined;

  constructor(options: BrowserTransportOptions = {}) {
    this.apiVersion = options.apiVersion ?? 'v9.2';
    this.clientUrlOverride = options.clientUrl;
  }

  /** The API base, e.g. `"https://org.crm4.dynamics.com/api/data/v9.2"`. */
  private get apiBase(): string {
    const clientUrl = (
      this.clientUrlOverride ?? Xrm.Utility.getGlobalContext().getClientUrl()
    ).replace(/\/$/, '');
    return `${clientUrl}/api/data/${this.apiVersion}`;
  }

  resolveUrl(path: string): string {
    // Absolute URLs (e.g. an @odata.nextLink) pass through unchanged.
    if (/^https?:\/\//i.test(path)) return path;
    const relative = path.startsWith('/') ? path.slice(1) : path;
    return `${this.apiBase}/${relative}`;
  }

  async send(request: DataverseRequest): Promise<DataverseHttpResponse> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      ...request.headers,
    };
    // A write body is JSON; GET reads carry no body and set no Content-Type.
    if (request.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(request.url, {
      method: request.method,
      credentials: 'include',
      headers,
      body: request.body,
      signal: request.signal,
    });

    return {
      status: response.status,
      ok: response.ok,
      getHeader: (name) => response.headers.get(name),
      text: () => response.text(),
    };
  }
}
