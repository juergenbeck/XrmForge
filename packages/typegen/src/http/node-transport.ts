/**
 * @xrmforge/typegen - Node transport for the Dataverse Web API
 *
 * A bearer-token {@link DataverseTransport} (the @xrmforge/dataverse-core
 * interface) for Node bulk metadata reads. It owns MSAL token acquisition and
 * caching (5-minute expiry buffer) and performs exactly one fetch per request;
 * the resilient runner in dataverse-core drives retry/backoff on top of it.
 *
 * Kept in typegen (not in dataverse-core) because it depends on @azure/identity,
 * which must never reach a browser bundle.
 */

import type { TokenCredential, AccessToken } from '@azure/identity';
import type {
  DataverseTransport,
  DataverseRequest,
  DataverseHttpResponse,
} from '@xrmforge/dataverse-core';
import { AuthenticationError, ErrorCode } from '../errors.js';
import { createLogger } from '../logger.js';

const log = createLogger('http');

/** Buffer before token expiry to trigger re-acquisition (5 minutes). */
const TOKEN_BUFFER_MS = 5 * 60 * 1000;

/** Options for {@link NodeTransport}. */
export interface NodeTransportOptions {
  /** Dataverse environment URL, e.g. "https://myorg.crm4.dynamics.com". */
  environmentUrl: string;
  /** Azure Identity credential. */
  credential: TokenCredential;
  /** API version (default: "v9.2"). */
  apiVersion?: string;
}

interface CachedToken {
  token: string;
  expiresAt: number; // Unix timestamp in ms
}

/**
 * Bearer-token transport: resolves URLs against the org's Web API base and
 * performs exactly one fetch per request, attaching a cached MSAL token.
 *
 * Per the {@link DataverseTransport} contract it does NOT retry (that is the
 * runner's job) and resolves - not rejects - for non-2xx HTTP responses.
 */
export class NodeTransport implements DataverseTransport {
  private readonly baseUrl: string;
  private readonly apiVersion: string;
  private readonly credential: TokenCredential;

  private cachedToken: CachedToken | null = null;
  /** Pending token refresh promise (prevents concurrent token requests). */
  private pendingTokenRefresh: Promise<string> | null = null;

  constructor(options: NodeTransportOptions) {
    this.baseUrl = options.environmentUrl.replace(/\/$/, '');
    this.apiVersion = options.apiVersion ?? 'v9.2';
    this.credential = options.credential;
  }

  /** Full API base URL, e.g. "https://myorg.crm4.dynamics.com/api/data/v9.2". */
  get apiUrl(): string {
    return `${this.baseUrl}/api/data/${this.apiVersion}`;
  }

  resolveUrl(path: string): string {
    // An already-absolute URL (e.g. an @odata.nextLink) passes through unchanged.
    return path.startsWith('http') ? path : `${this.apiUrl}${path}`;
  }

  /**
   * Acquire (or reuse) a token up front so an authentication failure surfaces
   * immediately as an {@link AuthenticationError}, OUTSIDE the runner's retry
   * loop. A bad credential is permanent and must not be retried; the runner
   * would otherwise treat the thrown error as a transient network failure.
   */
  async ensureToken(): Promise<void> {
    await this.getToken();
  }

  /** Drop the cached token so the next request re-acquires it (used on HTTP 401). */
  clearTokenCache(): void {
    this.cachedToken = null;
  }

  async send(request: DataverseRequest): Promise<DataverseHttpResponse> {
    // ensureToken() primes the cache right before the runner runs, so read the
    // cached value directly here. Calling getToken() again would double-refresh a
    // short-lived token (one refresh in ensureToken, another here). The fallback
    // covers the defensive case of a send() that was not preceded by ensureToken().
    const token = this.cachedToken?.token ?? (await this.getToken());

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Accept: 'application/json',
      Prefer: 'odata.include-annotations="*"',
      ...request.headers,
    };
    // A write body is JSON; GET reads carry no body and set no Content-Type.
    if (request.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(request.url, {
      method: request.method,
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

  // ─── Token Management ──────────────────────────────────────────────────────

  private async getToken(): Promise<string> {
    // Return the cached token if it has more than the buffer of validity left.
    if (this.cachedToken && this.cachedToken.expiresAt - Date.now() > TOKEN_BUFFER_MS) {
      return this.cachedToken.token;
    }

    // If a refresh is already in progress, wait for it instead of starting a second.
    if (this.pendingTokenRefresh) {
      return this.pendingTokenRefresh;
    }

    this.pendingTokenRefresh = this.refreshToken();
    try {
      return await this.pendingTokenRefresh;
    } finally {
      this.pendingTokenRefresh = null;
    }
  }

  private async refreshToken(): Promise<string> {
    log.debug('Requesting new access token');

    const scope = `${this.baseUrl}/.default`;
    let tokenResponse: AccessToken | null;

    try {
      tokenResponse = await this.credential.getToken(scope);
    } catch (error: unknown) {
      const cause = error instanceof Error ? error.message : String(error);
      throw new AuthenticationError(
        ErrorCode.AUTH_TOKEN_FAILED,
        `Failed to acquire access token for ${this.baseUrl}. ` +
          `Verify your authentication configuration.\n` +
          `Cause: ${cause}`,
        { environmentUrl: this.baseUrl, originalError: cause },
      );
    }

    if (!tokenResponse) {
      throw new AuthenticationError(
        ErrorCode.AUTH_TOKEN_FAILED,
        `No access token returned for ${this.baseUrl}. ` +
          `This may indicate invalid credentials or insufficient permissions.`,
        { environmentUrl: this.baseUrl },
      );
    }

    this.cachedToken = {
      token: tokenResponse.token,
      expiresAt: tokenResponse.expiresOnTimestamp,
    };

    log.debug('Access token acquired', {
      expiresIn: `${Math.round((tokenResponse.expiresOnTimestamp - Date.now()) / 1000)}s`,
    });

    return tokenResponse.token;
  }
}
