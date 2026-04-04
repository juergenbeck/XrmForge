/**
 * @xrmforge/typegen/helpers
 *
 * Browser-safe utility functions for D365 form scripts.
 * This entry point contains NO Node.js dependencies (no fs, path, etc.)
 * and is safe to use in esbuild IIFE bundles for Dynamics 365.
 *
 * Usage:
 * ```typescript
 * import { select, parseLookup, parseFormattedValue } from '@xrmforge/typegen/helpers';
 * ```
 *
 * @packageDocumentation
 */

export {
  select,
  selectExpand,
  parseLookup,
  parseLookups,
  parseFormattedValue,
} from './generators/webapi-helpers.js';

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
} from './generators/xrm-constants.js';
