/**
 * @xrmforge/helpers - Browser-safe runtime helpers for Dynamics 365
 *
 * This package contains everything that runs in the browser (D365 form scripts).
 * Zero Node.js dependencies. Safe to import in esbuild IIFE bundles.
 *
 * @example
 * ```typescript
 * import { select, parseLookup, DisplayState, typedForm } from '@xrmforge/helpers';
 * ```
 */

// Web API helpers
export {
  select,
  selectExpand,
  parseLookup,
  parseLookups,
  parseFormattedValue,
} from './webapi-helpers.js';

// Xrm constants (const enums, zero runtime overhead)
export {
  DisplayState,
  FormNotificationLevel,
  RequiredLevel,
  SubmitMode,
  SaveMode,
  ClientType,
  ClientState,
  OperationType,
  StructuralProperty,
  BindingType,
} from './xrm-constants.js';

// Action/Function runtime
export {
  executeRequest,
  executeMultiple,
  createBoundAction,
  createUnboundAction,
  createBoundFunction,
  createUnboundFunction,
  withProgress,
} from './action-runtime.js';
export type {
  ParameterMeta,
  ParameterMetaMap,
  BoundActionExecutor,
  BoundActionWithParamsExecutor,
  UnboundActionExecutor,
  UnboundActionWithParamsExecutor,
  UnboundFunctionExecutor,
  BoundFunctionExecutor,
} from './action-runtime.js';

// TypedForm proxy
export { typedForm } from './typed-form.js';
export type { TypedForm, FormFields } from './typed-form.js';
