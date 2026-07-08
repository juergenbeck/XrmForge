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
  expanded,
  expandedMany,
  parseLookup,
  parseLookups,
  parseFormattedValue,
  parseMultiSelect,
  formLookup,
  formLookupId,
  formLookupIdUnsafe,
  formLookupUnsafe,
} from './webapi-helpers.js';

// Xrm constants (const enums, zero runtime overhead)
export {
  DisplayState,
  FormType,
  isFormType,
  FormNotificationLevel,
  AppNotificationLevel,
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

// TypedForm proxy + TypedFields (cross-entity kindMap) + typedField (single field) + GUID utility
export { typedForm, typedFields, typedField, normalizeGuid, isUnsavedRecord } from './typed-form.js';
export type {
  TypedForm,
  TypedFields,
  AttrKind,
  KindMap,
  KindToAttribute,
  FormFields,
  FormTypeInfoProtocol,
} from './typed-form.js';

// Power Automate cloud flow caller
export { callCloudFlow } from './cloud-flow.js';
export type { CloudFlowOptions } from './cloud-flow.js';

// Attribute submit helpers (set/clear + force SubmitMode.Always)
export { clearAndSubmit, setUnsafeAndSubmit, setAndSubmit } from './form-submit.js';

// App-level (global) notification helper
export { addAppNotification, clearAppNotification } from './app-notification.js';
export type { AppNotificationOptions } from './app-notification.js';

// HTML WebResource context helpers (parent Xrm + hosting record)
export { parentXrm, getWebResourceContext } from './webresource.js';

// Environment variable reader (definition + value, cached)
export { getEnvironmentVariable, clearEnvironmentVariableCache } from './environment.js';
