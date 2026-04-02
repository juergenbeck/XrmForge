/**
 * @xrmforge/webapi - WebApiError
 *
 * Structured error type for Xrm.WebApi failures.
 */

export class WebApiError extends Error {
  /** HTTP status code (e.g. 400, 404, 500) */
  readonly statusCode: number;
  /** Dataverse error code (e.g. "0x80040217") */
  readonly errorCode: string;
  /** Inner error message from Dataverse */
  readonly innerMessage?: string;

  constructor(
    message: string,
    statusCode: number = 0,
    errorCode: string = '',
    innerMessage?: string,
  ) {
    super(message);
    this.name = 'WebApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.innerMessage = innerMessage;
  }

  /** Create from an Xrm.WebApi error response */
  static fromXrmError(error: unknown): WebApiError {
    if (error instanceof WebApiError) return error;

    const err = error as Record<string, unknown> | null;
    const message = (err?.['message'] as string) ?? String(error);
    const code = (err?.['errorCode'] as number) ?? 0;
    const errorCodeStr = (err?.['code'] as string) ?? '';
    const innerMsg = (err?.['innererror'] as Record<string, unknown>)?.['message'] as string | undefined;

    return new WebApiError(message, code, errorCodeStr, innerMsg);
  }
}
