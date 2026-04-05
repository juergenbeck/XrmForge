# Package Architecture

## Package Overview

| Package | Version | Tests | Description |
|---------|---------|-------|-------------|
| @xrmforge/typegen | 0.8.0 | 444 | Core: type generation engine, metadata client, HTTP client, helpers |
| @xrmforge/cli | 0.4.2 | 10 | CLI: generate, build, init commands |
| @xrmforge/testing | 0.2.0 | 76 | Test utilities: createFormMock, fireOnChange, setupXrmMock |
| @xrmforge/helpers | 0.1.0 | 59 | Browser-safe runtime: select(), parseLookup(), typedForm(), Xrm constants, Action executors |
| @xrmforge/webapi | 0.1.0 | 45 | Type-safe Xrm.WebApi client with QueryBuilder |
| @xrmforge/devkit | 0.4.0 | 42 | Build orchestration, scaffolding, AGENT.md generation |
| @xrmforge/eslint-plugin | 0.2.0 | 32 | 5 D365-specific ESLint rules |

**Total:** 708 tests across 7 packages.

## Dependency Graph

```
@xrmforge/cli
  |-- @xrmforge/typegen (generate command)
  |-- @xrmforge/devkit  (build + init commands)
  '-- commander (CLI framework)

@xrmforge/typegen
  |-- @azure/identity  (authentication)
  '-- fast-xml-parser  (FormXml parsing)

@xrmforge/devkit
  '-- esbuild (IIFE bundling)

@xrmforge/testing     (no runtime deps)
@xrmforge/helpers     (no runtime deps)
@xrmforge/webapi      (no runtime deps)
@xrmforge/eslint-plugin (ESLint peer dep)
```

## Package Details

### @xrmforge/typegen

The core package. Contains:

- **TypeGenerationOrchestrator** - Coordinates the entire generation pipeline
- **MetadataClient** - Queries Dataverse metadata (entities, forms, OptionSets, Custom APIs)
- **DataverseHttpClient** - Resilient REST client with retry, rate limiting, concurrency control
- **ChangeDetector** - Incremental generation via RetrieveMetadataChanges
- **MetadataCache** - Filesystem-based caching with version stamps
- **Generators** - Entity interfaces, form interfaces, OptionSet enums, Fields enums, EntityNames, Navigation Properties, Action/Function executors
- **Helpers** - select(), parseLookup(), parseFormattedValue() (moved to @xrmforge/helpers)
- **Xrm Constants** - DisplayState, FormNotificationLevel, RequiredLevel, SubmitMode, SaveMode, ClientType, ClientState (moved to @xrmforge/helpers)
- **Authentication** - createCredential() factory for 4 auth methods
- **Logging** - Scoped loggers with pluggable sinks (Console, JSON, Silent)
- **Errors** - Structured error hierarchy with ErrorCode enum (AUTH_1xxx, API_2xxx, META_3xxx, GEN_4xxx, CONFIG_5xxx)

### @xrmforge/cli

Command-line interface built with commander.js. Three commands:
- `xrmforge generate` - Orchestrates TypeGenerationOrchestrator
- `xrmforge build` - Delegates to devkit build()
- `xrmforge init` - Delegates to devkit scaffoldProject()

### @xrmforge/testing

FormContext mocking for unit tests:
- `createFormMock<TForm>(values)` - Creates a complete mock from simple key-value pairs
- `MockAttribute` - getValue/setValue, dirty tracking, onChange handlers, required level, submit mode
- `MockControl` - visible, disabled, label, notifications
- `MockUi` - Form notifications, tab/section stubs
- `MockEntity` - Entity ID, name, primary attribute
- `fireOnChange(fieldName)` - Triggers registered onChange handlers
- `setupXrmMock(options)` / `teardownXrmMock()` - Global Xrm mock with WebApi/Navigation stubs

### @xrmforge/helpers

Consolidates all browser-safe runtime code. Zero Node.js dependencies. Contains:
- **Web API helpers** - select(), parseLookup(), parseFormattedValue()
- **Xrm constants** - DisplayState, SubmitMode, RequiredLevel, SaveMode, ClientType, ClientState, FormNotificationLevel, OperationType
- **Action/Function executors** - createBoundAction(), executeRequest(), withProgress()
- **typedForm() proxy** - Proxy-based FormContext wrapper where `form.name` delegates to `getAttribute('name')`

### @xrmforge/webapi

Type-safe wrapper around Xrm.WebApi:
- `retrieve<T>(entityName, id, query)` - Single record
- `retrieveMultiple<T>(entityName, query, options)` - With pagination (maxPages)
- `create(entityName, data)` - Returns record ID
- `update(entityName, id, data)` - Void
- `remove(entityName, id)` - Void
- `QueryBuilder` - Fluent API: `.select().filter().orderBy().top().expand().build()`
- `WebApiError` - Structured errors with statusCode, errorCode, innerMessage

### @xrmforge/devkit

Build orchestration and project scaffolding:
- `build(config)` - Parallel esbuild IIFE builds via Promise.allSettled
- `watch(config)` - esbuild watch mode with rebuild callbacks
- `scaffoldProject(config)` - Generates 11 project files from templates
- `validateBuildConfig(config)` / `resolveBuildConfig(config)` - Config validation
- `BuildError` with codes: CONFIG_INVALID, ENTRY_NOT_FOUND, BUILD_FAILED, WATCH_ERROR
- Template system: 7 text templates in `src/scaffold/templates/`, loaded via `template-loader.ts`

### @xrmforge/eslint-plugin

5 rules for D365 form scripts (ESLint v9 flat config):
- `no-xrm-page` (error) - Forbids deprecated Xrm.Page API
- `no-magic-optionset` (warn) - Forbids magic numbers in OptionSet comparisons
- `no-sync-webapi` (error) - Forbids synchronous XMLHttpRequest
- `require-error-handling` (warn) - Requires try/catch in async on* event handlers
- `require-namespace` (warn) - Forbids window/globalThis assignments
