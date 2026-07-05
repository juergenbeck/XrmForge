/**
 * @xrmforge/dataverse-core - Error types
 *
 * Runtime-neutral error hierarchy for the Dataverse fetch layer. Zero
 * dependencies, so it is safe to include in both Node and browser bundles.
 */

/** Machine-readable error codes for the Dataverse core layer. */
export type DataverseErrorCode =
  | 'INVALID_IDENTIFIER'
  | 'INVALID_GUID'
  | 'REQUEST_FAILED'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'TIMEOUT'
  | 'ABORTED';

/**
 * Base error for all Dataverse core failures. Carries a structured code and an
 * optional context object for debugging.
 */
export class DataverseError extends Error {
  readonly code: DataverseErrorCode;
  readonly context: Record<string, unknown>;

  constructor(code: DataverseErrorCode, message: string, context: Record<string, unknown> = {}) {
    super(`[${code}] ${message}`);
    this.name = 'DataverseError';
    this.code = code;
    this.context = context;

    // Maintain a clean stack trace in V8 environments (Chrome / Node); a no-op
    // guard elsewhere (e.g. Firefox) where captureStackTrace is absent.
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DataverseError);
    }
  }
}

/**
 * HTTP-level failure from the Dataverse Web API: a non-successful response, or a
 * network/timeout failure after the runner exhausted its retries.
 */
export class DataverseHttpError extends DataverseError {
  /** HTTP status code, when the failure carried one (undefined for network/timeout). */
  readonly statusCode: number | undefined;
  /** Truncated response body, when available. */
  readonly responseBody: string | undefined;

  constructor(
    code: DataverseErrorCode,
    message: string,
    context: Record<string, unknown> & {
      statusCode?: number;
      responseBody?: string;
      url?: string;
    } = {},
  ) {
    super(code, message, context);
    this.name = 'DataverseHttpError';
    this.statusCode = context.statusCode;
    this.responseBody = context.responseBody;
  }
}

/** Type guard: is the given value a DataverseError (or subclass)? */
export function isDataverseError(error: unknown): error is DataverseError {
  return error instanceof DataverseError;
}
