/**
 * @xrmforge/typegen - Error Types
 *
 * Centralized error hierarchy for consistent error handling across the framework.
 * Every error carries a machine-readable code, a human-readable message,
 * and optional context for debugging.
 */

export enum ErrorCode {
  // Authentication errors (1xxx)
  AUTH_MISSING_CONFIG = 'AUTH_1001',
  AUTH_INVALID_CREDENTIALS = 'AUTH_1002',
  AUTH_TOKEN_FAILED = 'AUTH_1003',
  AUTH_TOKEN_EXPIRED = 'AUTH_1004',

  // API errors (2xxx)
  API_REQUEST_FAILED = 'API_2001',
  API_RATE_LIMITED = 'API_2002',
  API_NOT_FOUND = 'API_2003',
  API_UNAUTHORIZED = 'API_2004',
  API_TIMEOUT = 'API_2005',

  // Metadata errors (3xxx)
  META_ENTITY_NOT_FOUND = 'META_3001',
  META_SOLUTION_NOT_FOUND = 'META_3002',
  META_FORM_PARSE_FAILED = 'META_3003',
  META_ATTRIBUTE_UNKNOWN_TYPE = 'META_3004',

  // Generation errors (4xxx)
  GEN_OUTPUT_WRITE_FAILED = 'GEN_4001',
  GEN_TEMPLATE_FAILED = 'GEN_4002',
  GEN_INVALID_IDENTIFIER = 'GEN_4003',

  // Config errors (5xxx)
  CONFIG_INVALID = 'CONFIG_5001',
  CONFIG_FILE_NOT_FOUND = 'CONFIG_5002',
  CONFIG_ENV_VAR_MISSING = 'CONFIG_5003',
}

/**
 * Base error class for all XrmForge errors.
 * Carries a structured error code and optional context object.
 */
export class XrmForgeError extends Error {
  public readonly code: ErrorCode;
  public readonly context: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, context: Record<string, unknown> = {}) {
    super(`[${code}] ${message}`);
    this.name = 'XrmForgeError';
    this.code = code;
    this.context = context;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, XrmForgeError);
    }
  }
}

/**
 * Authentication-specific error.
 */
export class AuthenticationError extends XrmForgeError {
  constructor(code: ErrorCode, message: string, context: Record<string, unknown> = {}) {
    super(code, message, context);
    this.name = 'AuthenticationError';
  }
}

/**
 * Dataverse API request error.
 */
export class ApiRequestError extends XrmForgeError {
  public readonly statusCode: number | undefined;
  public readonly responseBody: string | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    context: Record<string, unknown> & {
      statusCode?: number;
      responseBody?: string;
      url?: string;
    } = {},
  ) {
    super(code, message, context);
    this.name = 'ApiRequestError';
    this.statusCode = context.statusCode;
    this.responseBody = context.responseBody;
  }
}

/**
 * Metadata retrieval or parsing error.
 */
export class MetadataError extends XrmForgeError {
  constructor(code: ErrorCode, message: string, context: Record<string, unknown> = {}) {
    super(code, message, context);
    this.name = 'MetadataError';
  }
}

/**
 * Type generation or file output error.
 */
export class GenerationError extends XrmForgeError {
  constructor(code: ErrorCode, message: string, context: Record<string, unknown> = {}) {
    super(code, message, context);
    this.name = 'GenerationError';
  }
}

/**
 * Configuration validation error.
 */
export class ConfigError extends XrmForgeError {
  constructor(code: ErrorCode, message: string, context: Record<string, unknown> = {}) {
    super(code, message, context);
    this.name = 'ConfigError';
  }
}

/**
 * Type guard to check if an unknown error is an XrmForgeError.
 */
export function isXrmForgeError(error: unknown): error is XrmForgeError {
  return error instanceof XrmForgeError;
}

/**
 * Type guard for API rate limit errors (HTTP 429).
 */
export function isRateLimitError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && error.code === ErrorCode.API_RATE_LIMITED;
}
