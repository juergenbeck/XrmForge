/**
 * @xrmforge/dataverse-core - Resilient runner
 *
 * Wraps a {@link DataverseTransport} with retry, backoff, rate-limit awareness,
 * and a per-attempt timeout. Deliberately browser-lean: no concurrency semaphore
 * (paging is sequential, so there is nothing to gate), smaller backoff caps, and
 * fewer retries than the Node bulk client, so an interactive UI fails fast
 * instead of hanging through six long retries.
 */

import { DataverseError, DataverseHttpError, type DataverseErrorCode } from './errors.js';
import type {
  DataverseHttpResponse,
  DataverseRequest,
  DataverseTransport,
} from './transport.js';

// Browser-lean defaults (cf. the Node typegen client: 3 retries / 60s cap / 10 rate-limit retries).
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const DEFAULT_MAX_BACKOFF_MS = 8_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RATE_LIMIT_RETRIES = 3;

/** Max characters of a response body retained in an error's context. */
const MAX_RESPONSE_BODY_LENGTH = 2_000;

/** Tuning options for {@link ResilientRunner}. All optional; browser-lean defaults apply. */
export interface RunnerOptions {
  /** Max retry attempts for transient failures (network, timeout, 5xx). Default 2. */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff. Default 500. */
  retryBaseDelayMs?: number;
  /** Upper bound in ms for a single backoff delay. Default 8000. */
  maxBackoffMs?: number;
  /** Per-attempt request timeout in ms. Default 30000. */
  timeoutMs?: number;
  /** Max consecutive HTTP 429 responses tolerated before giving up. Default 3. */
  maxRateLimitRetries?: number;
}

/**
 * Executes requests against a transport with resilience, then parses the JSON
 * response body. Stateless across calls, so a single runner can be reused for
 * an entire paging loop.
 */
export class ResilientRunner {
  private readonly transport: DataverseTransport;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly maxBackoffMs: number;
  private readonly timeoutMs: number;
  private readonly maxRateLimitRetries: number;

  constructor(transport: DataverseTransport, options: RunnerOptions = {}) {
    this.transport = transport;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.maxBackoffMs = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRateLimitRetries = options.maxRateLimitRetries ?? DEFAULT_MAX_RATE_LIMIT_RETRIES;
  }

  /**
   * Execute a request with resilience and parse its JSON response body.
   *
   * @typeParam T - Expected shape of the parsed response.
   * @param request - The request to run; its `url` must already be absolute.
   * @returns The parsed body, or `undefined` for an empty / HTTP 204 response.
   * @throws {DataverseError} `ABORTED` when the caller's signal fires.
   * @throws {DataverseHttpError} on a non-retryable HTTP error or exhausted retries.
   */
  async send<T>(request: DataverseRequest): Promise<T> {
    return this.execute<T>(request, 1, 0);
  }

  private async execute<T>(
    request: DataverseRequest,
    attempt: number,
    rateLimitRetries: number,
  ): Promise<T> {
    if (request.signal?.aborted) {
      throw new DataverseError('ABORTED', 'Request aborted before execution', { url: request.url });
    }

    // Combine a per-attempt timeout with the caller's abort signal: whichever
    // fires first aborts this attempt.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const onCallerAbort = (): void => controller.abort();
    request.signal?.addEventListener('abort', onCallerAbort, { once: true });

    let response: DataverseHttpResponse;
    try {
      response = await this.transport.send({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
        signal: controller.signal,
      });
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      request.signal?.removeEventListener('abort', onCallerAbort);
      return this.handleTransportError<T>(request, attempt, rateLimitRetries, error);
    }
    clearTimeout(timeoutId);
    request.signal?.removeEventListener('abort', onCallerAbort);

    if (!response.ok) {
      return this.handleHttpError<T>(request, response, attempt, rateLimitRetries);
    }

    const text = await response.text();
    if (response.status === 204 || text === '') {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  /** Classify a thrown transport error as caller-abort, timeout, or network failure. */
  private async handleTransportError<T>(
    request: DataverseRequest,
    attempt: number,
    rateLimitRetries: number,
    error: unknown,
  ): Promise<T> {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    if (isAbort) {
      // The caller aborted: propagate, do not retry.
      if (request.signal?.aborted) {
        throw new DataverseError('ABORTED', 'Request aborted by caller', { url: request.url });
      }
      // Our timeout aborted: retry while attempts remain.
      if (attempt <= this.maxRetries) {
        await this.sleep(this.calculateBackoff(attempt));
        return this.execute<T>(request, attempt + 1, rateLimitRetries);
      }
      throw new DataverseHttpError(
        'TIMEOUT',
        `Request timed out after ${this.timeoutMs}ms (${this.maxRetries} retries exhausted)`,
        { url: request.url },
      );
    }

    // Network-level failure: retry while attempts remain.
    if (attempt <= this.maxRetries) {
      await this.sleep(this.calculateBackoff(attempt));
      return this.execute<T>(request, attempt + 1, rateLimitRetries);
    }
    throw new DataverseHttpError('REQUEST_FAILED', `Network error after ${this.maxRetries} retries`, {
      url: request.url,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }

  /** Handle a non-2xx HTTP response: 429/5xx retry, 401/404/other throw. */
  private async handleHttpError<T>(
    request: DataverseRequest,
    response: DataverseHttpResponse,
    attempt: number,
    rateLimitRetries: number,
  ): Promise<T> {
    const url = request.url;

    // 429 Rate limited: throttling, not a failure. Use a separate counter so a
    // string of 429s cannot exhaust the transient-error retry budget. The body
    // is not read on a retry path (it would only be discarded).
    if (response.status === 429) {
      if (rateLimitRetries >= this.maxRateLimitRetries) {
        throw new DataverseHttpError(
          'RATE_LIMITED',
          `Rate limit retries exhausted (${this.maxRateLimitRetries} consecutive HTTP 429 responses)`,
          { statusCode: 429, url },
        );
      }
      const retryAfterHeader = response.getHeader('Retry-After');
      const parsedRetryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
      const delay = Number.isFinite(parsedRetryAfter)
        ? parsedRetryAfter * 1000
        : this.calculateBackoff(rateLimitRetries + 1);
      await this.sleep(delay);
      return this.execute<T>(request, attempt, rateLimitRetries + 1);
    }

    // 5xx Server error: retryable while attempts remain.
    if (response.status >= 500 && attempt <= this.maxRetries) {
      await this.sleep(this.calculateBackoff(attempt));
      return this.execute<T>(request, attempt + 1, rateLimitRetries);
    }

    // From here the failure is non-retryable, so read the body once for context.
    const body = await response.text();

    // 401 Unauthorized: in the browser this means the cookie session is missing
    // or expired. A retry cannot fix it (there is no token to refresh), so fail.
    if (response.status === 401) {
      throw new DataverseHttpError(
        'UNAUTHORIZED',
        'Unauthorized (HTTP 401): the Dataverse session is missing or expired.',
        { statusCode: 401, url, responseBody: body.substring(0, MAX_RESPONSE_BODY_LENGTH) },
      );
    }

    const code: DataverseErrorCode = response.status === 404 ? 'NOT_FOUND' : 'REQUEST_FAILED';
    throw new DataverseHttpError(code, `Dataverse API error: HTTP ${response.status}`, {
      statusCode: response.status,
      url,
      responseBody: body.substring(0, MAX_RESPONSE_BODY_LENGTH),
    });
  }

  /** Exponential backoff with jitter, capped at {@link maxBackoffMs}. */
  private calculateBackoff(attempt: number): number {
    const exponential = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
    const jitter = Math.random() * this.retryBaseDelayMs;
    return Math.min(exponential + jitter, this.maxBackoffMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
