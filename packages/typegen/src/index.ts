/**
 * @xrmforge/typegen
 *
 * TypeScript declaration generator for Dynamics 365 / Dataverse.
 * Generates entity interfaces, form interfaces, and OptionSet enums
 * that extend @types/xrm.
 *
 * @packageDocumentation
 */

// ─── Error Types ─────────────────────────────────────────────────────────────
export {
  XrmForgeError,
  AuthenticationError,
  ApiRequestError,
  MetadataError,
  GenerationError,
  ConfigError,
  ErrorCode,
  isXrmForgeError,
  isRateLimitError,
} from './errors.js';

// ─── Logging ─────────────────────────────────────────────────────────────────
export {
  Logger,
  ConsoleLogSink,
  JsonLogSink,
  SilentLogSink,
  LogLevel,
  configureLogging,
  createLogger,
} from './logger.js';
export type { LogEntry, LogSink } from './logger.js';

// ─── Authentication ──────────────────────────────────────────────────────────
export { createCredential } from './auth/index.js';
export type {
  AuthConfig,
  AuthMethod,
  ClientCredentialsAuth,
  InteractiveAuth,
  DeviceCodeAuth,
} from './auth/index.js';

// ─── HTTP Client ─────────────────────────────────────────────────────────────
export { DataverseHttpClient } from './http/index.js';
export type { HttpClientOptions } from './http/index.js';
