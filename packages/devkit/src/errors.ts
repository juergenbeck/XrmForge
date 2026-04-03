/**
 * @xrmforge/devkit - Build Error Types
 *
 * Structured error types for build operations.
 */

export enum BuildErrorCode {
  /** Build configuration is invalid or missing required fields */
  CONFIG_INVALID = 'BUILD_6001',
  /** Entry point file not found on disk */
  ENTRY_NOT_FOUND = 'BUILD_6002',
  /** esbuild compilation failed (syntax errors, missing imports) */
  BUILD_FAILED = 'BUILD_6003',
  /** Error in watch mode */
  WATCH_ERROR = 'BUILD_6004',
}

/**
 * Error class for build operations.
 * Carries a machine-readable code and optional context for debugging.
 */
export class BuildError extends Error {
  public readonly code: BuildErrorCode;
  public readonly context: Record<string, unknown>;

  constructor(code: BuildErrorCode, message: string, context: Record<string, unknown> = {}) {
    super(`[${code}] ${message}`);
    this.name = 'BuildError';
    this.code = code;
    this.context = context;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BuildError);
    }
  }
}
