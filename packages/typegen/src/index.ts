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

// ─── Metadata Client ─────────────────────────────────────────────────────────
export {
  MetadataClient,
  MetadataCache,
  ChangeDetector,
  parseForm,
  extractControlFields,
  FastXmlParser,
  defaultXmlParser,
  getPrimaryLabel,
  getJSDocLabel,
  labelToIdentifier,
  generateEnumMembers,
  getLabelLanguagesParam,
  DEFAULT_LABEL_CONFIG,
} from './metadata/index.js';
export type { LabelConfig } from './metadata/index.js';
export type { ChangeDetectionResult } from './metadata/index.js';
export type { XmlParser, XmlElement } from './metadata/index.js';
export type { CustomApiTypeInfo } from './metadata/index.js';
export type {
  EntityMetadata,
  AttributeMetadata,
  StringAttributeMetadata,
  IntegerAttributeMetadata,
  DecimalAttributeMetadata,
  MoneyAttributeMetadata,
  DateTimeAttributeMetadata,
  LookupAttributeMetadata,
  PicklistAttributeMetadata,
  StatusAttributeMetadata,
  StateAttributeMetadata,
  OptionSetMetadata,
  OptionMetadata,
  SystemFormMetadata,
  ParsedForm,
  FormControl,
  FormTab,
  FormSection,
  OneToManyRelationshipMetadata,
  ManyToManyRelationshipMetadata,
  SolutionComponent,
  EntityTypeInfo,
  Label,
  LocalizedLabel,
} from './metadata/index.js';

// ─── Type Mapping ────────────────────────────────────────────────────────────
export {
  getEntityPropertyType,
  getFormAttributeType,
  getFormControlType,
  toSafeIdentifier,
  toPascalCase,
  toLookupValueProperty,
  isLookupType,
  isPartyListType,
  shouldIncludeInEntityInterface,
  getFormMockValueType,
} from './generators/index.js';

// ─── Generator Label Utilities ───────────────────────────────────────────────
export {
  getSecondaryLabel,
  formatDualLabel,
  disambiguateEnumMembers,
} from './generators/index.js';

// ─── Code Generators ─────────────────────────────────────────────────────────
export {
  generateEntityInterface,
  generateOptionSetEnum,
  generateEntityOptionSets,
  generateFormInterface,
  generateEntityForms,
  generateEntityFieldsEnum,
  generateEntityNavigationProperties,
  generateActivityPartyInterface,
  generateEntityNamesEnum,
} from './generators/index.js';

export type {
  EntityGeneratorOptions,
  OptionSetGeneratorOptions,
  FormGeneratorOptions,
  EntityNamesGeneratorOptions,
  EntityFieldsGeneratorOptions,
} from './generators/index.js';

// ─── Action/Function Generator ───────────────────────────────────────────────
export {
  generateActionDeclarations,
  generateActionModule,
  groupCustomApis,
} from './generators/index.js';

export type {
  ActionGeneratorOptions,
  GroupedCustomApis,
} from './generators/index.js';

// ─── Orchestrator (Public API) ───────────────────────────────────────────────
export { TypeGenerationOrchestrator } from './orchestrator/index.js';

export type {
  GenerateConfig,
  GenerationResult,
  EntityGenerationResult,
  GeneratedFile,
  CacheStats,
  CheckResult,
  CheckFinding,
} from './orchestrator/index.js';
