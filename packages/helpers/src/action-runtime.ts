/**
 * @xrmforge/helpers - Action/Function Runtime Helpers
 *
 * Factory functions for type-safe Custom API execution.
 * These are imported by generated action/function modules.
 *
 * Design:
 * - `createBoundAction` / `createUnboundAction`: Produce executor objects
 *   with `.execute()` (calls Xrm.WebApi) and `.request()` (for executeMultiple)
 * - `executeRequest`: Central execute wrapper (single place for the `as any` cast)
 * - `withProgress`: Convenience wrapper with progress indicator + error dialog
 *
 * @example
 * ```typescript
 * // Generated code (in generated/actions/quote.ts):
 * import { createBoundAction } from '@xrmforge/helpers';
 * export const WinQuote = createBoundAction('markant_winquote', 'quote');
 *
 * // Developer code (in quote-form.ts):
 * import { WinQuote } from '../generated/actions/quote';
 * const response = await WinQuote.execute(recordId);
 * ```
 */

import { OperationType, StructuralProperty } from './xrm-constants.js';

// Types

/** Parameter metadata for getMetadata().parameterTypes */
export interface ParameterMeta {
  typeName: string;
  structuralProperty: number;
}

/** Map of parameter names to their OData metadata */
export type ParameterMetaMap = Record<string, ParameterMeta>;

/** Executor for a bound action without additional parameters */
export interface BoundActionExecutor {
  execute(recordId: string): Promise<Response>;
  request(recordId: string): Record<string, unknown>;
}

/** Executor for a bound action with typed parameters */
export interface BoundActionWithParamsExecutor<TParams> {
  execute(recordId: string, params: TParams): Promise<Response>;
  request(recordId: string, params: TParams): Record<string, unknown>;
}

/** Executor for an unbound action without parameters */
export interface UnboundActionExecutor {
  execute(): Promise<Response>;
  request(): Record<string, unknown>;
}

/** Executor for an unbound action with typed parameters and optional typed response */
export interface UnboundActionWithParamsExecutor<TParams, TResult = void> {
  execute(params: TParams): Promise<TResult extends void ? Response : TResult>;
  request(params: TParams): Record<string, unknown>;
}

/** Executor for an unbound function with typed response */
export interface UnboundFunctionExecutor<TResult> {
  execute(): Promise<TResult>;
  request(): Record<string, unknown>;
}

/** Executor for a bound function with typed response */
export interface BoundFunctionExecutor<TResult> {
  execute(recordId: string): Promise<TResult>;
  request(recordId: string): Record<string, unknown>;
}

// Central Execute

/**
 * Execute a single request via Xrm.WebApi.online.execute().
 *
 * This is the ONLY place in the entire framework where the `as any` cast happens.
 * All generated executors call this function internally.
 */
export function executeRequest(request: Record<string, unknown>): Promise<Response> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Xrm.WebApi as any).online.execute(request) as Promise<Response>;
}

/**
 * Execute multiple requests via Xrm.WebApi.online.executeMultiple().
 *
 * @param requests - Array of request objects (from `.request()` factories).
 *   Wrap a subset in an inner array for transactional changeset execution.
 */
export function executeMultiple(
  requests: Array<Record<string, unknown> | Array<Record<string, unknown>>>,
): Promise<Response[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Xrm.WebApi as any).online.executeMultiple(requests) as Promise<Response[]>;
}

// Request Builder (internal)

function cleanRecordId(id: string): string {
  return id.replace(/[{}]/g, '');
}

function buildBoundRequest(
  operationName: string,
  entityLogicalName: string,
  operationType: OperationType,
  recordId: string,
  paramMeta?: ParameterMetaMap,
  params?: Record<string, unknown>,
): Record<string, unknown> {
  const parameterTypes: Record<string, ParameterMeta> = {
    entity: {
      typeName: `mscrm.${entityLogicalName}`,
      structuralProperty: StructuralProperty.EntityType,
    },
  };

  if (paramMeta) {
    for (const [key, meta] of Object.entries(paramMeta)) {
      parameterTypes[key] = meta;
    }
  }

  const request: Record<string, unknown> = {
    getMetadata: () => ({
      boundParameter: 'entity',
      parameterTypes,
      operationName,
      operationType,
    }),
    entity: {
      id: cleanRecordId(recordId),
      entityType: entityLogicalName,
    },
  };

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request[key] = value;
    }
  }

  return request;
}

function buildUnboundRequest(
  operationName: string,
  operationType: OperationType,
  paramMeta?: ParameterMetaMap,
  params?: Record<string, unknown>,
): Record<string, unknown> {
  const parameterTypes: Record<string, ParameterMeta> = {};

  if (paramMeta) {
    for (const [key, meta] of Object.entries(paramMeta)) {
      parameterTypes[key] = meta;
    }
  }

  const request: Record<string, unknown> = {
    getMetadata: () => ({
      boundParameter: null,
      parameterTypes,
      operationName,
      operationType,
    }),
  };

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request[key] = value;
    }
  }

  return request;
}

// Action Factories

/**
 * Create an executor for a bound action (entity-bound).
 *
 * @param operationName - Custom API unique name (e.g. "markant_winquote")
 * @param entityLogicalName - Entity logical name (e.g. "quote")
 */
export function createBoundAction(
  operationName: string,
  entityLogicalName: string,
): BoundActionExecutor;

/**
 * Create an executor for a bound action with typed parameters.
 *
 * @param operationName - Custom API unique name
 * @param entityLogicalName - Entity logical name
 * @param paramMeta - Parameter metadata map (parameter name to OData type info)
 */
export function createBoundAction<TParams extends Record<string, unknown>>(
  operationName: string,
  entityLogicalName: string,
  paramMeta: ParameterMetaMap,
): BoundActionWithParamsExecutor<TParams>;

export function createBoundAction<TParams extends Record<string, unknown>>(
  operationName: string,
  entityLogicalName: string,
  paramMeta?: ParameterMetaMap,
): BoundActionExecutor | BoundActionWithParamsExecutor<TParams> {
  return {
    execute(recordId: string, params?: TParams): Promise<Response> {
      const req = buildBoundRequest(
        operationName, entityLogicalName, OperationType.Action,
        recordId, paramMeta, params,
      );
      return executeRequest(req);
    },
    request(recordId: string, params?: TParams): Record<string, unknown> {
      return buildBoundRequest(
        operationName, entityLogicalName, OperationType.Action,
        recordId, paramMeta, params,
      );
    },
  };
}

/**
 * Create an executor for an unbound (global) action without parameters.
 *
 * @param operationName - Custom API unique name
 */
export function createUnboundAction(
  operationName: string,
): UnboundActionExecutor;

/**
 * Create an executor for an unbound action with typed parameters and response.
 *
 * @param operationName - Custom API unique name
 * @param paramMeta - Parameter metadata map
 */
export function createUnboundAction<
  TParams extends Record<string, unknown>,
  TResult = void,
>(
  operationName: string,
  paramMeta: ParameterMetaMap,
): UnboundActionWithParamsExecutor<TParams, TResult>;

export function createUnboundAction<
  TParams extends Record<string, unknown>,
  TResult = void,
>(
  operationName: string,
  paramMeta?: ParameterMetaMap,
): UnboundActionExecutor | UnboundActionWithParamsExecutor<TParams, TResult> {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- return type varies (Response or parsed JSON)
    async execute(params?: TParams): Promise<any> {
      const req = buildUnboundRequest(
        operationName, OperationType.Action, paramMeta, params,
      );
      const response = await executeRequest(req);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      if (response.status !== 204) {
        return response.json();
      }
      return response;
    },
    request(params?: TParams): Record<string, unknown> {
      return buildUnboundRequest(
        operationName, OperationType.Action, paramMeta, params,
      );
    },
  };
}

// Function Factories

/**
 * Create an executor for an unbound (global) function with typed response.
 *
 * @param operationName - Function name (e.g. "WhoAmI")
 */
export function createUnboundFunction<TResult>(
  operationName: string,
): UnboundFunctionExecutor<TResult> {
  return {
    async execute(): Promise<TResult> {
      const req = buildUnboundRequest(operationName, OperationType.Function);
      const response = await executeRequest(req);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      return response.json() as Promise<TResult>;
    },
    request(): Record<string, unknown> {
      return buildUnboundRequest(operationName, OperationType.Function);
    },
  };
}

/**
 * Create an executor for a bound function with typed response.
 *
 * @param operationName - Function name
 * @param entityLogicalName - Entity logical name
 */
export function createBoundFunction<TResult>(
  operationName: string,
  entityLogicalName: string,
): BoundFunctionExecutor<TResult> {
  return {
    async execute(recordId: string): Promise<TResult> {
      const req = buildBoundRequest(
        operationName, entityLogicalName, OperationType.Function, recordId,
      );
      const response = await executeRequest(req);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      return response.json() as Promise<TResult>;
    },
    request(recordId: string): Record<string, unknown> {
      return buildBoundRequest(
        operationName, entityLogicalName, OperationType.Function, recordId,
      );
    },
  };
}

// Convenience

/**
 * Execute an async operation with Xrm progress indicator.
 *
 * Shows a progress spinner before the operation, closes it after,
 * and shows an error dialog on failure.
 *
 * @param message - Progress indicator message (e.g. "Processing quote...")
 * @param operation - Async function to execute
 * @returns The result of the operation
 *
 * @example
 * ```typescript
 * await withProgress('Processing quote...', () => WinQuote.execute(recordId));
 * ```
 */
export async function withProgress<T>(
  message: string,
  operation: () => Promise<T>,
): Promise<T> {
  Xrm.Utility.showProgressIndicator(message);
  try {
    return await operation();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    Xrm.Navigation.openErrorDialog({ message: msg });
    throw error;
  } finally {
    Xrm.Utility.closeProgressIndicator();
  }
}
