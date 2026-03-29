/**
 * @xrmforge/typegen - Dataverse HTTP Client
 *
 * Resilient HTTP client for the Dataverse Web API.
 *
 * Features:
 * - Token caching with 5-minute buffer before expiry
 * - Automatic retry with exponential backoff and jitter
 * - Rate limit awareness (HTTP 429 with Retry-After)
 * - Request timeout via AbortController
 * - Concurrency control (semaphore pattern, NOT recursive)
 * - Automatic OData paging via @odata.nextLink with safety limit
 * - Input sanitization helpers against OData injection
 */

import type { TokenCredential, AccessToken } from '@azure/identity';
import { ApiRequestError, AuthenticationError, ErrorCode } from '../errors.js';
import { createLogger } from '../logger.js';

const log = createLogger('http');

// ─── Internal Constants ──────────────────────────────────────────────────────

/** Buffer before token expiry to trigger re-acquisition (5 minutes) */
const TOKEN_BUFFER_MS = 5 * 60 * 1000;

/** Maximum backoff delay cap for exponential retry (60 seconds) */
const MAX_BACKOFF_MS = 60_000;

/** Maximum characters of response body stored in error context */
const MAX_RESPONSE_BODY_LENGTH = 2000;

/** Maximum length of user-provided values in error messages (prevents log injection) */
const MAX_ERROR_VALUE_LENGTH = 100;

/** Maximum consecutive HTTP 429 retries before giving up (prevents infinite loops) */
const DEFAULT_MAX_RATE_LIMIT_RETRIES = 10;

// ─── Configuration ───────────────────────────────────────────────────────────

export interface HttpClientOptions {
  /** Dataverse environment URL, e.g. "https://myorg.crm4.dynamics.com" */
  environmentUrl: string;

  /** Azure Identity credential */
  credential: TokenCredential;

  /** API version (default: "v9.2") */
  apiVersion?: string;

  /** Maximum retry attempts for transient errors (default: 3) */
  maxRetries?: number;

  /** Base delay in ms for exponential backoff (default: 1000) */
  retryBaseDelayMs?: number;

  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;

  /** Maximum concurrent requests to Dataverse (default: 5) */
  maxConcurrency?: number;

  /** Maximum pages to follow via @odata.nextLink (default: 100, safety limit) */
  maxPages?: number;

  /** Maximum consecutive HTTP 429 retries before giving up (default: 10) */
  maxRateLimitRetries?: number;

  /**
   * Read-only mode (default: true).
   * When true, the client will ONLY allow GET requests and throw an error
   * for any POST, PATCH, PUT, or DELETE attempt.
   *
   * SAFETY: XrmForge typegen is a read-only tool. It must NEVER modify
   * data in Dataverse environments. This flag defaults to true and should
   * only be set to false for the @xrmforge/webapi package (future).
   */
  readOnly?: boolean;
}

// ─── Token Cache ─────────────────────────────────────────────────────────────

interface CachedToken {
  token: string;
  expiresAt: number; // Unix timestamp in ms
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class DataverseHttpClient {
  private readonly baseUrl: string;
  private readonly apiVersion: string;
  private readonly credential: TokenCredential;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly timeoutMs: number;
  private readonly maxConcurrency: number;
  private readonly maxPages: number;
  private readonly maxRateLimitRetries: number;
  private readonly readOnly: boolean;

  private cachedToken: CachedToken | null = null;

  // Semaphore for concurrency control (non-recursive)
  private activeConcurrentRequests = 0;
  private readonly waitQueue: Array<() => void> = [];

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.environmentUrl.replace(/\/$/, '');
    this.apiVersion = options.apiVersion ?? 'v9.2';
    this.credential = options.credential;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1000;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxConcurrency = options.maxConcurrency ?? 5;
    this.maxPages = options.maxPages ?? 100;
    this.maxRateLimitRetries = options.maxRateLimitRetries ?? DEFAULT_MAX_RATE_LIMIT_RETRIES;
    this.readOnly = options.readOnly ?? true; // SAFETY: default to read-only
  }

  /**
   * Full API base URL, e.g. "https://myorg.crm4.dynamics.com/api/data/v9.2"
   */
  get apiUrl(): string {
    return `${this.baseUrl}/api/data/${this.apiVersion}`;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Execute a GET request against the Dataverse Web API.
   * Handles token caching, retries, rate limits, and timeout.
   */
  async get<T>(path: string): Promise<T> {
    const url = this.resolveUrl(path);
    return this.executeWithConcurrency<T>(url);
  }

  /**
   * Execute a GET request and automatically follow @odata.nextLink for paging.
   * Returns all pages combined into a single array.
   *
   * Safety: Stops after `maxPages` iterations to prevent infinite loops.
   */
  async getAll<T>(path: string): Promise<T[]> {
    interface ODataPage {
      value: T[];
      '@odata.nextLink'?: string;
    }

    const allResults: T[] = [];
    let currentUrl: string | null = this.resolveUrl(path);
    let page = 0;

    while (currentUrl) {
      page++;
      if (page > this.maxPages) {
        log.warn(
          `Stopped paging after ${this.maxPages} pages (safety limit). ` +
            `${allResults.length} records retrieved. Increase maxPages if this is expected.`,
        );
        break;
      }

      const response: ODataPage = await this.executeWithConcurrency<ODataPage>(currentUrl);

      allResults.push(...response.value);
      currentUrl = response['@odata.nextLink'] ?? null;

      if (currentUrl) {
        log.debug(`Following @odata.nextLink (page ${page}), ${allResults.length} records so far`);
      }
    }

    return allResults;
  }

  // ─── Read-Only Enforcement ─────────────────────────────────────────────

  /**
   * Returns true if this client is in read-only mode (the safe default).
   */
  get isReadOnly(): boolean {
    return this.readOnly;
  }

  /**
   * Assert that a non-GET operation is allowed.
   * Throws immediately if the client is in read-only mode.
   *
   * @throws {ApiRequestError} always in read-only mode
   * @internal This method exists so that future packages (e.g. @xrmforge/webapi)
   * can reuse the HTTP client for write operations when readOnly is explicitly false.
   */
  assertWriteAllowed(operation: string): void {
    if (this.readOnly) {
      throw new ApiRequestError(
        ErrorCode.API_REQUEST_FAILED,
        `BLOCKED: Write operation "${operation}" rejected. ` +
          `This client is in read-only mode (readOnly: true). ` +
          `XrmForge typegen must NEVER modify data in Dataverse. ` +
          `Set readOnly: false only for @xrmforge/webapi (not for typegen).`,
        { operation, readOnly: true },
      );
    }
  }

  // ─── Input Sanitization ──────────────────────────────────────────────────

  /**
   * Validate that a value is a safe OData identifier (entity name, attribute name).
   * Prevents OData injection by allowing only: starts with letter/underscore,
   * followed by alphanumeric/underscore.
   *
   * @throws {ApiRequestError} if the value contains invalid characters
   */
  static sanitizeIdentifier(value: string): string {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
      throw new ApiRequestError(
        ErrorCode.API_REQUEST_FAILED,
        `Invalid OData identifier: "${value.substring(0, MAX_ERROR_VALUE_LENGTH).replace(/[\r\n]/g, '')}". ` +
          `Only letters, digits, and underscores allowed; must start with a letter or underscore.`,
        { value: value.substring(0, MAX_ERROR_VALUE_LENGTH) },
      );
    }
    return value;
  }

  /**
   * Validate that a value is a properly formatted GUID.
   *
   * @throws {ApiRequestError} if the format is invalid
   */
  static sanitizeGuid(value: string): string {
    const guidPattern =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!guidPattern.test(value)) {
      throw new ApiRequestError(
        ErrorCode.API_REQUEST_FAILED,
        `Invalid GUID format: "${value}".`,
        { value },
      );
    }
    return value;
  }

  /**
   * Escape a string for use inside OData single-quoted string literals.
   * Doubles single quotes to prevent injection.
   */
  static escapeODataString(value: string): string {
    return value.replace(/'/g, "''");
  }

  // ─── Token Management ────────────────────────────────────────────────────

  private async getToken(): Promise<string> {
    // Return cached token if it has more than 5 minutes of validity remaining
    if (this.cachedToken && this.cachedToken.expiresAt - Date.now() > TOKEN_BUFFER_MS) {
      return this.cachedToken.token;
    }

    log.debug('Requesting new access token');

    const scope = `${this.baseUrl}/.default`;
    let tokenResponse: AccessToken | null;

    try {
      tokenResponse = await this.credential.getToken(scope);
    } catch (error: unknown) {
      throw new AuthenticationError(
        ErrorCode.AUTH_TOKEN_FAILED,
        `Failed to acquire access token for ${this.baseUrl}. ` +
          `Verify your authentication configuration.`,
        {
          environmentUrl: this.baseUrl,
          originalError: error instanceof Error ? error.message : String(error),
        },
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

  // ─── Concurrency Control ─────────────────────────────────────────────────

  /**
   * Execute a request within the concurrency semaphore.
   * The semaphore is acquired ONCE per logical request. Retries happen
   * INSIDE the semaphore to avoid the recursive slot exhaustion bug.
   */
  private async executeWithConcurrency<T>(url: string): Promise<T> {
    await this.acquireSlot();
    try {
      return await this.executeWithRetry<T>(url, 1);
    } finally {
      this.releaseSlot();
    }
  }

  private acquireSlot(): Promise<void> {
    if (this.activeConcurrentRequests < this.maxConcurrency) {
      this.activeConcurrentRequests++;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(() => {
        this.activeConcurrentRequests++;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.activeConcurrentRequests--;
    const next = this.waitQueue.shift();
    if (next) next();
  }

  // ─── Retry Logic (runs INSIDE a single concurrency slot) ─────────────────

  private async executeWithRetry<T>(url: string, attempt: number, rateLimitRetries: number = 0): Promise<T> {
    const token = await this.getToken();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      log.debug(`GET ${url}`, { attempt });

      response = await fetch(url, {
        method: 'GET', // Explicit: never rely on default
        headers: {
          Authorization: `Bearer ${token}`,
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          Accept: 'application/json',
          Prefer: 'odata.include-annotations="*"',
        },
        signal: controller.signal,
      });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);

      // Timeout (check both instanceof and name for cross-platform Node.js compatibility)
      if ((fetchError instanceof Error) && fetchError.name === 'AbortError') {
        if (attempt <= this.maxRetries) {
          const delay = this.calculateBackoff(attempt);
          log.warn(`Request timed out, retrying in ${delay}ms (${attempt}/${this.maxRetries})`, {
            url,
          });
          await this.sleep(delay);
          return this.executeWithRetry<T>(url, attempt + 1);
        }

        throw new ApiRequestError(
          ErrorCode.API_TIMEOUT,
          `Request timed out after ${this.timeoutMs}ms (${this.maxRetries} retries exhausted)`,
          { url, timeoutMs: this.timeoutMs },
        );
      }

      // Network error
      if (attempt <= this.maxRetries) {
        const delay = this.calculateBackoff(attempt);
        log.warn(`Network error, retrying in ${delay}ms (${attempt}/${this.maxRetries})`, {
          url,
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        });
        await this.sleep(delay);
        return this.executeWithRetry<T>(url, attempt + 1);
      }

      throw new ApiRequestError(
        ErrorCode.API_REQUEST_FAILED,
        `Network error after ${this.maxRetries} retries`,
        {
          url,
          originalError: fetchError instanceof Error ? fetchError.message : String(fetchError),
        },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // ── Handle HTTP Errors ──

    if (!response.ok) {
      return this.handleHttpError<T>(response, url, attempt, rateLimitRetries);
    }

    log.debug(`GET ${url} -> ${response.status}`, { attempt });
    return response.json() as Promise<T>;
  }

  private async handleHttpError<T>(
    response: Response,
    url: string,
    attempt: number,
    rateLimitRetries: number,
  ): Promise<T> {
    const body = await response.text();

    // 429 Rate Limited: retry with separate counter to prevent infinite loops
    if (response.status === 429) {
      if (rateLimitRetries >= this.maxRateLimitRetries) {
        throw new ApiRequestError(
          ErrorCode.API_RATE_LIMITED,
          `Rate limit retries exhausted (${this.maxRateLimitRetries} consecutive 429 responses)`,
          { url, rateLimitRetries },
        );
      }

      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader
        ? parseInt(retryAfterHeader, 10) * 1000
        : this.calculateBackoff(rateLimitRetries + 1);

      log.warn(`Rate limited (HTTP 429). Waiting ${retryAfterMs}ms (${rateLimitRetries + 1}/${this.maxRateLimitRetries}).`, {
        url,
        retryAfterHeader,
      });

      await this.sleep(retryAfterMs);
      // Do NOT increment attempt for 429: these are not "failures", they are throttling
      return this.executeWithRetry<T>(url, attempt, rateLimitRetries + 1);
    }

    // 401 Unauthorized: clear token cache and retry once
    if (response.status === 401 && attempt === 1) {
      log.warn('HTTP 401 received, clearing token cache and retrying');
      this.cachedToken = null;
      return this.executeWithRetry<T>(url, attempt + 1);
    }

    // 5xx Server Errors: retryable
    if (response.status >= 500 && attempt <= this.maxRetries) {
      const delay = this.calculateBackoff(attempt);
      log.warn(
        `Server error ${response.status}, retrying in ${delay}ms (${attempt}/${this.maxRetries})`,
      );
      await this.sleep(delay);
      return this.executeWithRetry<T>(url, attempt + 1);
    }

    // Non-retryable error: throw
    const errorCode =
      response.status === 401
        ? ErrorCode.API_UNAUTHORIZED
        : response.status === 404
          ? ErrorCode.API_NOT_FOUND
          : ErrorCode.API_REQUEST_FAILED;

    throw new ApiRequestError(
      errorCode,
      `Dataverse API error: HTTP ${response.status} ${response.statusText}`,
      {
        url,
        statusCode: response.status,
        responseBody: body.substring(0, MAX_RESPONSE_BODY_LENGTH),
      },
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private resolveUrl(path: string): string {
    return path.startsWith('http') ? path : `${this.apiUrl}${path}`;
  }

  private calculateBackoff(attempt: number): number {
    const exponential = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
    const jitter = Math.random() * this.retryBaseDelayMs;
    return Math.min(exponential + jitter, MAX_BACKOFF_MS);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
