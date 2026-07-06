/**
 * @xrmforge/typegen - Dataverse HTTP Client
 *
 * Resilient HTTP client for the Dataverse Web API metadata reads.
 *
 * Architecture (since the dataverse-core migration):
 * - Transport + resilience come from @xrmforge/dataverse-core: a Node bearer-token
 *   {@link NodeTransport} performs each fetch, the {@link ResilientRunner} drives
 *   retry/backoff, rate-limit awareness (HTTP 429) and per-attempt timeout.
 * - This class keeps the Node-only concerns the browser-lean runner deliberately
 *   omits: a concurrency semaphore, HTTP 401 token-refresh-and-retry, and
 *   @odata.nextLink paging (getAll). It also maps core's DataverseError family
 *   onto the framework's ApiRequestError so the public error contract is stable.
 * - Input sanitization is delegated to the shared dataverse-core sanitizers
 *   (single source of truth), re-wrapped as ApiRequestError.
 */

import type { TokenCredential } from '@azure/identity';
import {
  ResilientRunner,
  DataverseError,
  DataverseHttpError,
  sanitizeIdentifier as coreSanitizeIdentifier,
  sanitizeGuid as coreSanitizeGuid,
  escapeODataString as coreEscapeODataString,
  type DataverseErrorCode,
} from '@xrmforge/dataverse-core';
import { ApiRequestError, ErrorCode } from '../errors.js';
import { createLogger } from '../logger.js';
import { NodeTransport } from './node-transport.js';

const log = createLogger('http');

// ─── Internal Constants ──────────────────────────────────────────────────────

/** Default retry attempts for transient errors (network, timeout, 5xx). */
const DEFAULT_MAX_RETRIES = 3;

/** Default base delay in ms for exponential backoff. */
const DEFAULT_RETRY_BASE_DELAY_MS = 1000;

/** Maximum backoff delay cap for exponential retry (60 seconds). */
const MAX_BACKOFF_MS = 60_000;

/** Default request timeout in ms. */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Default maximum concurrent requests to Dataverse. */
const DEFAULT_MAX_CONCURRENCY = 5;

/** Default maximum pages to follow via @odata.nextLink (safety limit). */
const DEFAULT_MAX_PAGES = 100;

/** Default maximum consecutive HTTP 429 retries before giving up. */
const DEFAULT_MAX_RATE_LIMIT_RETRIES = 10;

// ─── Error Mapping (dataverse-core -> typegen public contract) ───────────────

/** Map a dataverse-core error code onto the typegen ErrorCode enum. */
function mapErrorCode(code: DataverseErrorCode): ErrorCode {
  switch (code) {
    case 'NOT_FOUND':
      return ErrorCode.API_NOT_FOUND;
    case 'RATE_LIMITED':
      return ErrorCode.API_RATE_LIMITED;
    case 'UNAUTHORIZED':
      return ErrorCode.API_UNAUTHORIZED;
    case 'TIMEOUT':
      return ErrorCode.API_TIMEOUT;
    case 'INVALID_IDENTIFIER':
    case 'INVALID_GUID':
    case 'REQUEST_FAILED':
    case 'ABORTED':
    default:
      return ErrorCode.API_REQUEST_FAILED;
  }
}

/**
 * Rephrase the few core runner messages that read oddly in the Node/token
 * context. The core layer is runtime-neutral and leans browser-side (its 401
 * text talks about a "session"); typegen authenticates with a bearer token, so
 * that message is rephrased. All other messages are already neutral and kept
 * verbatim.
 */
function nodeMessage(code: DataverseErrorCode, original: string): string {
  if (code === 'UNAUTHORIZED') {
    return 'Unauthorized (HTTP 401): the access token was rejected or has expired.';
  }
  return original;
}

/**
 * Convert a thrown error into the framework's ApiRequestError. A DataverseError
 * (or DataverseHttpError) from the shared core layer is mapped by code, carrying
 * over statusCode/responseBody; any other error (e.g. AuthenticationError) is
 * returned unchanged so it propagates with its own type.
 */
function toApiRequestError(error: unknown): Error {
  if (error instanceof DataverseHttpError) {
    return new ApiRequestError(mapErrorCode(error.code), nodeMessage(error.code, error.message), {
      ...error.context,
      statusCode: error.statusCode,
      responseBody: error.responseBody,
    });
  }
  if (error instanceof DataverseError) {
    return new ApiRequestError(mapErrorCode(error.code), nodeMessage(error.code, error.message), {
      ...error.context,
    });
  }
  if (error instanceof Error) {
    return error;
  }
  return new ApiRequestError(ErrorCode.API_REQUEST_FAILED, String(error));
}

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

// ─── Client ──────────────────────────────────────────────────────────────────

export class DataverseHttpClient {
  private readonly transport: NodeTransport;
  private readonly runner: ResilientRunner;
  private readonly maxConcurrency: number;
  private readonly maxPages: number;
  private readonly readOnly: boolean;

  // Semaphore for concurrency control (non-recursive). The browser-lean core
  // runner has no semaphore, so gating the Node bulk load stays here.
  private activeConcurrentRequests = 0;
  private readonly waitQueue: Array<() => void> = [];

  constructor(options: HttpClientOptions) {
    this.maxConcurrency = options.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
    this.maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
    this.readOnly = options.readOnly ?? true; // SAFETY: default to read-only

    this.transport = new NodeTransport({
      environmentUrl: options.environmentUrl,
      credential: options.credential,
      apiVersion: options.apiVersion,
    });

    // Node bulk tuning (the runner's own defaults are browser-lean: 2/8s/3).
    this.runner = new ResilientRunner(this.transport, {
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      retryBaseDelayMs: options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
      maxBackoffMs: MAX_BACKOFF_MS,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRateLimitRetries: options.maxRateLimitRetries ?? DEFAULT_MAX_RATE_LIMIT_RETRIES,
    });
  }

  /**
   * Full API base URL, e.g. "https://myorg.crm4.dynamics.com/api/data/v9.2"
   */
  get apiUrl(): string {
    return this.transport.apiUrl;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Execute a GET request against the Dataverse Web API.
   * Handles token caching, retries, rate limits, and timeout.
   *
   * @param path - API path (relative or absolute URL)
   * @param signal - Optional AbortSignal to cancel the request
   */
  async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const url = this.transport.resolveUrl(path);
    return this.executeWithConcurrency<T>(url, signal);
  }

  /**
   * Execute a GET request and automatically follow @odata.nextLink for paging.
   * Returns all pages combined into a single array.
   *
   * Safety: Stops after `maxPages` iterations to prevent infinite loops.
   *
   * @param path - API path (relative or absolute URL)
   * @param signal - Optional AbortSignal to cancel the request
   */
  async getAll<T>(path: string, signal?: AbortSignal): Promise<T[]> {
    interface ODataPage {
      value: T[];
      '@odata.nextLink'?: string;
    }

    const allResults: T[] = [];
    let currentUrl: string | null = this.transport.resolveUrl(path);
    let page = 0;

    while (currentUrl) {
      // Check abort before each page
      if (signal?.aborted) {
        throw new ApiRequestError(
          ErrorCode.API_REQUEST_FAILED,
          `Request aborted after ${page} pages (${allResults.length} records retrieved)`,
          { url: currentUrl, pagesCompleted: page },
        );
      }

      page++;
      if (page > this.maxPages) {
        log.warn(
          `Stopped paging after ${this.maxPages} pages (safety limit). ` +
            `${allResults.length} records retrieved. Increase maxPages if this is expected.`,
        );
        break;
      }

      const response: ODataPage = await this.executeWithConcurrency<ODataPage>(currentUrl, signal);

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

  // ─── Input Sanitization (delegated to @xrmforge/dataverse-core) ────────────

  /**
   * Validate that a value is a safe OData identifier (entity name, attribute name).
   * Prevents OData injection by allowing only: starts with letter/underscore,
   * followed by alphanumeric/underscore.
   *
   * @throws {ApiRequestError} if the value contains invalid characters
   */
  static sanitizeIdentifier(value: string): string {
    try {
      return coreSanitizeIdentifier(value);
    } catch (error: unknown) {
      throw toApiRequestError(error);
    }
  }

  /**
   * Validate that a value is a properly formatted GUID.
   *
   * @throws {ApiRequestError} if the format is invalid
   */
  static sanitizeGuid(value: string): string {
    try {
      return coreSanitizeGuid(value);
    } catch (error: unknown) {
      throw toApiRequestError(error);
    }
  }

  /**
   * Escape a string for use inside OData single-quoted string literals.
   * Doubles single quotes to prevent injection.
   */
  static escapeODataString(value: string): string {
    return coreEscapeODataString(value);
  }

  // ─── Request Execution ─────────────────────────────────────────────────────

  /**
   * Execute a request within the concurrency semaphore. The semaphore is
   * acquired ONCE per logical request; the resilience (retry/backoff) happens
   * inside, driven by the core runner.
   */
  private async executeWithConcurrency<T>(url: string, signal?: AbortSignal): Promise<T> {
    await this.acquireSlot();
    try {
      return await this.executeWithAuth<T>(url, signal);
    } finally {
      this.releaseSlot();
    }
  }

  /**
   * Run the request and handle the HTTP 401 token-refresh case (401-C): the
   * cached token may be stale, so clear it and retry exactly once. A second 401
   * is a real authorization failure and propagates. The token is primed up front
   * so a bad credential throws an AuthenticationError before the runner runs
   * (outside its retry loop), never mislabelled as a transient network failure.
   */
  private async executeWithAuth<T>(url: string, signal?: AbortSignal): Promise<T> {
    await this.transport.ensureToken();
    try {
      return await this.runnerSend<T>(url, signal);
    } catch (error: unknown) {
      if (error instanceof ApiRequestError && error.code === ErrorCode.API_UNAUTHORIZED) {
        log.warn('HTTP 401 received, clearing token cache and retrying');
        this.transport.clearTokenCache();
        await this.transport.ensureToken();
        // Retry once; a second 401 throws here and is not caught again.
        return await this.runnerSend<T>(url, signal);
      }
      throw error;
    }
  }

  /**
   * Send one request through the core runner and translate any dataverse-core
   * error into the framework's ApiRequestError (stable public contract).
   */
  private async runnerSend<T>(url: string, signal?: AbortSignal): Promise<T> {
    try {
      return await this.runner.send<T>({ method: 'GET', url, signal });
    } catch (error: unknown) {
      throw toApiRequestError(error);
    }
  }

  // ─── Concurrency Control ─────────────────────────────────────────────────

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
}
