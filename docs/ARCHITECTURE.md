# XrmForge Architecture

> **Status:** Living document describing the current implementation state.
> **Last updated:** 2026-04-04 (Session 10)
> **Version:** 7 packages, 666+ tests across all packages.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Package Architecture](#2-package-architecture)
3. [Generated Types](#3-generated-types)
4. [CLI Commands](#4-cli-commands)
5. [Build Architecture](#5-build-architecture)
6. [Incremental Generation](#6-incremental-generation)
7. [HTTP Client](#7-http-client)
8. [Authentication](#8-authentication)
9. [Testing Framework](#9-testing-framework)
10. [ESLint Plugin](#10-eslint-plugin)
11. [AGENT.md System](#11-agentmd-system)
12. [types/xrm Pitfalls](#12-typesxrm-pitfalls)
13. [typegen/helpers Subpath](#13-typegenhelpers-subpath)
14. [Showcases](#14-showcases)
15. [CI/CD](#15-cicd)
16. [Technical Debt](#16-technical-debt)
17. [Roadmap](#17-roadmap)
18. [Design Principles](#18-design-principles)

---

## 1. Executive Summary

XrmForge is an open-source TypeScript toolkit for type-safe Dynamics 365 / Dataverse WebResource development. It generates TypeScript declarations from live Dataverse metadata, turning runtime string errors into compile-time type errors.

**Core value proposition:** Every field name, OptionSet value, tab name, entity name, and subgrid name becomes a typed constant with IDE autocomplete and compile-time validation.

**Target audience:** D365 developers who write form scripts (WebResources) in JavaScript/TypeScript and want compile-time safety, zero magic strings, and modern tooling (esbuild, vitest, ESLint).

**Tech stack:** TypeScript, pnpm monorepo with Turborepo, esbuild for IIFE bundles, vitest for testing, @azure/identity for authentication, fast-xml-parser for FormXml parsing.

**npm organization:** [@xrmforge](https://www.npmjs.com/org/xrmforge)

---

## 2. Package Architecture

### 2.1 Package Overview

| Package | Version | Tests | Description |
|---------|---------|-------|-------------|
| @xrmforge/typegen | 0.6.0 | 444 | Core: type generation engine, metadata client, HTTP client, helpers |
| @xrmforge/cli | 0.4.2 | 10 | CLI: generate, build, init commands |
| @xrmforge/testing | 0.2.0 | 76 | Test utilities: createFormMock, fireOnChange, setupXrmMock |
| @xrmforge/formhelpers | 0.1.0 | 17 | Runtime: typedForm() proxy (894 bytes) |
| @xrmforge/webapi | 0.1.0 | 45 | Type-safe Xrm.WebApi client with QueryBuilder |
| @xrmforge/devkit | 0.4.0 | 42 | Build orchestration, scaffolding, AGENT.md generation |
| @xrmforge/eslint-plugin | 0.2.0 | 32 | 5 D365-specific ESLint rules |

**Total:** 666 tests across 7 packages.

### 2.2 Dependency Graph

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
@xrmforge/formhelpers (no runtime deps)
@xrmforge/webapi      (no runtime deps)
@xrmforge/eslint-plugin (ESLint peer dep)
```

### 2.3 Package Details

#### @xrmforge/typegen

The core package. Contains:

- **TypeGenerationOrchestrator** - Coordinates the entire generation pipeline
- **MetadataClient** - Queries Dataverse metadata (entities, forms, OptionSets, Custom APIs)
- **DataverseHttpClient** - Resilient REST client with retry, rate limiting, concurrency control
- **ChangeDetector** - Incremental generation via RetrieveMetadataChanges
- **MetadataCache** - Filesystem-based caching with version stamps
- **Generators** - Entity interfaces, form interfaces, OptionSet enums, Fields enums, EntityNames, Navigation Properties, Action/Function executors
- **Helpers** - select(), parseLookup(), parseFormattedValue() (browser-safe via /helpers subpath)
- **Xrm Constants** - DisplayState, FormNotificationLevel, RequiredLevel, SubmitMode, SaveMode, ClientType, ClientState
- **Authentication** - createCredential() factory for 4 auth methods
- **Logging** - Scoped loggers with pluggable sinks (Console, JSON, Silent)
- **Errors** - Structured error hierarchy with ErrorCode enum (AUTH_1xxx, API_2xxx, META_3xxx, GEN_4xxx, CONFIG_5xxx)

#### @xrmforge/cli

Command-line interface built with commander.js. Three commands:
- `xrmforge generate` - Orchestrates TypeGenerationOrchestrator
- `xrmforge build` - Delegates to devkit build()
- `xrmforge init` - Delegates to devkit scaffoldProject()

#### @xrmforge/testing

FormContext mocking for unit tests:
- `createFormMock<TForm>(values)` - Creates a complete mock from simple key-value pairs
- `MockAttribute` - getValue/setValue, dirty tracking, onChange handlers, required level, submit mode
- `MockControl` - visible, disabled, label, notifications
- `MockUi` - Form notifications, tab/section stubs
- `MockEntity` - Entity ID, name, primary attribute
- `fireOnChange(fieldName)` - Triggers registered onChange handlers
- `setupXrmMock(options)` / `teardownXrmMock()` - Global Xrm mock with WebApi/Navigation stubs

#### @xrmforge/formhelpers

A Proxy-based alternative to Fields enums:
- `typedForm<TForm>(formContext)` - Returns a proxy where `form.name` calls `getAttribute('name')`
- **GET trap:** Property access delegates to getAttribute(); `$context` returns raw FormContext; `$control(name)` returns getControl()
- **SET trap:** Throws TypeError forcing `.setValue()` usage
- **HAS trap:** Checks if attribute exists on the form

#### @xrmforge/webapi

Type-safe wrapper around Xrm.WebApi:
- `retrieve<T>(entityName, id, query)` - Single record
- `retrieveMultiple<T>(entityName, query, options)` - With pagination (maxPages)
- `create(entityName, data)` - Returns record ID
- `update(entityName, id, data)` - Void
- `remove(entityName, id)` - Void
- `QueryBuilder` - Fluent API: `.select().filter().orderBy().top().expand().build()`
- `WebApiError` - Structured errors with statusCode, errorCode, innerMessage

#### @xrmforge/devkit

Build orchestration and project scaffolding:
- `build(config)` - Parallel esbuild IIFE builds via Promise.allSettled
- `watch(config)` - esbuild watch mode with rebuild callbacks
- `scaffoldProject(config)` - Generates 11 project files from templates
- `validateBuildConfig(config)` / `resolveBuildConfig(config)` - Config validation
- `BuildError` with codes: CONFIG_INVALID, ENTRY_NOT_FOUND, BUILD_FAILED, WATCH_ERROR
- Template system: 7 text templates in `src/scaffold/templates/`, loaded via `template-loader.ts`

#### @xrmforge/eslint-plugin

5 rules for D365 form scripts (ESLint v9 flat config):
- `no-xrm-page` (error) - Forbids deprecated Xrm.Page API
- `no-magic-optionset` (warn) - Forbids magic numbers in OptionSet comparisons
- `no-sync-webapi` (error) - Forbids synchronous XMLHttpRequest
- `require-error-handling` (warn) - Requires try/catch in async on* event handlers
- `require-namespace` (warn) - Forbids window/globalThis assignments

---

## 3. Generated Types

Running `xrmforge generate` produces the following TypeScript declarations:

### 3.1 Entity Interfaces (`entities/{entity}.d.ts`)

```typescript
declare namespace XrmForge.Entities {
  /** Account | Konto */
  interface Account {
    /** Account Name | Kontoname */
    name: string | null;
    accountid: string | null;
    revenue: number | null;
    _parentaccountid_value: string | null;  // Lookup GUID
    // ...
  }
}
```

**Type mapping:** String/Memo/EntityName to `string`, Integer/BigInt/Decimal/Double/Money to `number`, Boolean to `boolean`, DateTime/Uniqueidentifier/Lookup to `string`, Picklist/State/Status to `number`.

### 3.2 Entity Fields Enums (`entities/{entity}.d.ts`)

```typescript
declare namespace XrmForge.Entities {
  const enum AccountFields {
    /** Account Name | Kontoname */
    Name = 'name',
    Revenue = 'revenue',
    // all readable attributes
  }
}
```

Used for Web API `$select`: `select(AccountFields.Name, AccountFields.Revenue)`.

### 3.3 Navigation Properties (`entities/{entity}.d.ts`)

```typescript
declare namespace XrmForge.Entities {
  const enum AccountNavigation {
    PrimaryContactId = 'primarycontactid',
    ContactCustomerAccounts = 'contact_customer_accounts',
    // OneToMany + ManyToMany relationships
  }
}
```

### 3.4 Form Interfaces (`forms/{entity}.d.ts`)

```typescript
declare namespace XrmForge.Forms.Account {
  // Union type restricting valid field names
  type AccountMainFormFields = 'name' | 'telephone1' | 'revenue';

  // Mapped type: field name to Xrm attribute type
  type AccountMainFormAttributeMap = {
    name: Xrm.Attributes.StringAttribute;
    telephone1: Xrm.Attributes.StringAttribute;
    revenue: Xrm.Attributes.NumberAttribute;
  };

  // Mapped type: field name to Xrm control type
  type AccountMainFormControlMap = {
    name: Xrm.Controls.StringControl;
    telephone1: Xrm.Controls.StringControl;
    revenue: Xrm.Controls.NumberControl;
  };

  // Fields enum for autocomplete
  const enum AccountMainFormFieldsEnum {
    /** Account Name | Kontoname */
    AccountName = 'name',
    Telephone1 = 'telephone1',
    Revenue = 'revenue',
  }

  // Type-safe FormContext with overloaded getAttribute/getControl
  interface AccountMainForm extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'> {
    getAttribute<K extends AccountMainFormFields>(name: K): AccountMainFormAttributeMap[K];
    getAttribute(index: number): Xrm.Attributes.Attribute;
    getAttribute(): Xrm.Attributes.Attribute[];

    getControl<K extends AccountMainFormFields>(name: K): AccountMainFormControlMap[K];
    getControl(index: number): Xrm.Controls.Control;
    getControl(): Xrm.Controls.Control[];
  }
}
```

**Special controls** are typed based on their FormXml ClassID:
- Subgrid: `Xrm.Controls.GridControl`
- Editable Grid: `Xrm.Controls.GridControl`
- Quick View: `Xrm.Controls.QuickFormControl`
- Web Resource / iFrame: `Xrm.Controls.IframeControl`

### 3.5 Tabs/Sections/Subgrids/QuickViews Enums

```typescript
const enum AccountMainFormTabs { Summary = 'SUMMARY_TAB', Details = 'DETAILS_TAB' }
const enum AccountMainFormSections { General = 'GENERAL', Address = 'ADDRESS' }
const enum AccountMainFormSubgrids { Contacts = 'Contacts_Subgrid' }
const enum AccountMainFormQuickViews { ContactPreview = 'ContactQuickView' }
```

### 3.6 OptionSet Enums (`optionsets/{entity}.d.ts`)

```typescript
declare namespace XrmForge.OptionSets.Account {
  /** Account Category Code | Kontokategoriecode */
  const enum AccountCategoryCode {
    /** Preferred Customer | Bevorzugter Kunde */
    PreferredCustomer = 1,
    Standard = 2,
  }
}
```

Includes Picklist, Status, State, and MultiSelectPicklist attributes. Duplicate labels are disambiguated with `_{Value}` suffix.

### 3.7 EntityNames Enum (`entity-names.d.ts`)

```typescript
declare namespace XrmForge {
  const enum EntityNames {
    Account = 'account',
    Contact = 'contact',
    // all entities in scope
  }
}
```

### 3.8 MockValues Types (in form interfaces)

```typescript
type AccountMainFormMockValues = {
  name?: string | null;
  telephone1?: string | null;
  revenue?: number | null;
};
```

Used with `createFormMock<AccountMainForm, AccountMainFormMockValues>({ name: 'Test' })`.

### 3.9 Action/Function Executors (`actions/{entity|global}.d.ts` + `.ts`)

**Declaration (.d.ts):**
```typescript
declare namespace XrmForge.Actions {
  interface NormalizePhoneParams { Input: string; AllowSuspicious?: boolean; }
  interface NormalizePhoneResult { Normalized: string; Status: number; }
}
```

**Runtime module (.ts):**
```typescript
import { createUnboundAction } from '@xrmforge/typegen';
export const NormalizePhone = createUnboundAction<NormalizePhoneParams, NormalizePhoneResult>(
  'markant_NormalizePhone',
  { Input: { typeName: 'String', structuralProperty: 1 } }
);
// Usage: const result = await NormalizePhone.execute({ Input: '123' });
```

Factory functions: `createBoundAction`, `createUnboundAction`, `createBoundFunction`, `createUnboundFunction`. Batch execution via `executeMultiple()`, progress UI via `withProgress()`.

### 3.10 Dual-Language Labels

All generated JSDoc comments support dual-language labels:
```typescript
/** Account Name | Kontoname */
Name = 'name',
```

German umlauts are transliterated in identifiers: ae, oe, ue, ss (e.g. "Ubergeordnet" becomes `Uebergeordnet`).

---

## 4. CLI Commands

### 4.1 `xrmforge generate`

Generates TypeScript declarations from a Dataverse environment.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--url <url>` | string | required | Dataverse environment URL |
| `--auth <method>` | string | required | Auth method: client-credentials, interactive, device-code, token |
| `--tenant-id <id>` | string | varies | Azure AD tenant ID |
| `--client-id <id>` | string | varies | Azure AD application ID |
| `--client-secret <s>` | string | varies | Client secret (client-credentials only) |
| `--token <token>` | string | varies | Pre-acquired bearer token (token auth only) |
| `--entities <list>` | string | - | Comma-separated entity logical names |
| `--solutions <list>` | string | - | Comma-separated solution unique names |
| `--output <dir>` | string | ./typings | Output directory |
| `--label-language <n>` | string | 1033 | Primary label language (LCID) |
| `--secondary-language <n>` | string | - | Secondary label language for JSDoc |
| `--no-forms` | flag | - | Skip form interface generation |
| `--no-optionsets` | flag | - | Skip OptionSet enum generation |
| `--actions` | flag | false | Generate Custom API executors |
| `--actions-filter <prefix>` | string | - | Filter Custom APIs by uniquename prefix |
| `--cache` | flag | false | Enable metadata caching for incremental generation |
| `--no-cache` | flag | - | Force full metadata refresh |
| `--cache-dir <dir>` | string | .xrmforge/cache | Cache directory |
| `-v, --verbose` | flag | false | Debug logging |

At least one of `--entities` or `--solutions` is required.

### 4.2 `xrmforge build`

Builds WebResources as IIFE bundles using esbuild (via @xrmforge/devkit).

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--watch` | flag | false | Watch mode with incremental rebuilds |
| `--minify` | flag | from config | Override minification setting |
| `--no-sourcemap` | flag | - | Disable source maps |
| `--out-dir <dir>` | string | from config | Override output directory |
| `-v, --verbose` | flag | false | Show error stacks |

Reads configuration from `xrmforge.config.json`.

### 4.3 `xrmforge init`

Scaffolds a new D365 form scripting project.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `[dir]` | positional | . | Target directory |
| `--name <name>` | string | dir name | Project name for package.json |
| `--prefix <prefix>` | string | contoso | Publisher prefix |
| `--namespace <ns>` | string | PascalCase(prefix) | Base namespace for scripts |
| `--skip-install` | flag | false | Skip npm install |
| `--force` | flag | false | Allow non-empty directories |

Generates 11 files: package.json, tsconfig.json, xrmforge.config.json, vitest.config.ts, .gitignore, AGENT.md, example-form.ts, example-form.test.ts, typings/.gitkeep, GitHub Actions CI, Azure DevOps Pipeline.

---

## 5. Build Architecture

### 5.1 esbuild IIFE Bundles

XrmForge uses esbuild to create IIFE (Immediately Invoked Function Expression) bundles for Dynamics 365. D365 requires scripts to be registered as namespace.function (e.g. `Contoso.Account.onLoad`).

**esbuild configuration per entry:**
```
format: 'iife'
bundle: true
globalName: entry.namespace    // e.g. 'Contoso.Account'
target: config.target          // default: 'es2020'
minify: config.minify
sourcemap: config.sourcemap
external: config.external      // e.g. ['fs', 'path'] for Node.js deps
```

All entries are built in parallel using `Promise.allSettled()`, allowing partial success.

### 5.2 xrmforge.config.json Schema

```json
{
  "build": {
    "outDir": "./dist/prefix_/JS",
    "target": "es2020",
    "sourcemap": true,
    "minify": true,
    "external": [],
    "entries": {
      "entry_name": {
        "input": "./src/forms/account-form.ts",
        "namespace": "Contoso.Account",
        "out": "Account/OnLoad.js"
      }
    }
  }
}
```

### 5.3 globalName Handling

esbuild automatically creates nested globals from dotted namespaces:
```javascript
// namespace: "Contoso.Account" produces:
var Contoso = Contoso || {};
Contoso.Account = (() => { return { onLoad, onSave }; })();
```

D365 event registration: `Contoso.Account.onLoad`.

---

## 6. Incremental Generation

### 6.1 Overview

Incremental generation uses the Dataverse `RetrieveMetadataChanges` function to detect which entities have changed since the last generation. This reduces generation time from seconds to milliseconds (measured: 4720ms to 473ms, 10x improvement).

### 6.2 Components

**ChangeDetector** (`src/metadata/change-detector.ts`):
- `getInitialVersionStamp()` - First run: fetches the initial ServerVersionStamp
- `detectChanges(clientVersionStamp)` - Subsequent runs: returns changedEntityNames, deletedEntityNames, newVersionStamp

**MetadataCache** (`src/metadata/cache.ts`):
- Filesystem-based: `.xrmforge/cache/metadata.json`
- Stores: manifest (version, environment URL, ServerVersionStamp, last refreshed, entity list) + entityTypeInfos per entity
- Validation: checks cache version, environment URL match, file existence

### 6.3 Flow

```
First run (no cache):
  1. Fetch all entity metadata
  2. getInitialVersionStamp()
  3. Save cache with ServerVersionStamp

Subsequent run (cache exists):
  1. Load cache, validate environment URL
  2. detectChanges(cachedVersionStamp)
  3. Fetch only changed entities
  4. Remove deleted entities from cache
  5. Save cache with new ServerVersionStamp

Expired stamp (>90 days):
  Error code 0x80044352 detected
  Fall back to full refresh
```

### 6.4 RetrieveMetadataChanges API

- **Type:** OData Function (GET, not POST)
- **URL:** `/RetrieveMetadataChanges(Query=@q,ClientVersionStamp=@s)?@q={...}&@s='...'`
- **Response:** EntityMetadata[] with HasChanged flag, ServerVersionStamp, DeletedMetadata

---

## 7. HTTP Client

### 7.1 DataverseHttpClient

The core HTTP client (`src/http/client.ts`) provides resilient communication with the Dataverse Web API.

**Key methods:**
- `get<T>(path, signal?)` - Single GET request with retry
- `getAll<T>(path, signal?)` - GET with automatic @odata.nextLink paging (max 100 pages)

### 7.2 Read-Only Default

The client defaults to `readOnly: true`, blocking POST/PATCH/PUT/DELETE requests. This prevents accidental data mutations during type generation. Write access requires explicit `readOnly: false`.

### 7.3 Retry with Exponential Backoff

- **Base delay:** 1000ms (configurable)
- **Max backoff:** 60 seconds
- **Jitter:** Random delay up to base delay
- **Formula:** `min(baseDelay * 2^(attempt-1) + jitter, 60000)`
- **Max retries:** configurable (default: 3)

### 7.4 Rate Limiting (HTTP 429)

- **Separate counter** from standard retries (not mixed)
- **Retry-After header** respected (seconds converted to milliseconds)
- **Max 10 consecutive 429 retries** (DEFAULT_MAX_RATE_LIMIT_RETRIES)
- 429 responses do NOT increment the standard retry counter

### 7.5 Concurrency Control

Non-recursive semaphore pattern:
- **maxConcurrency:** 5 (default)
- Wait queue with FIFO ordering
- All retries happen inside a single slot (prevents slot exhaustion)

### 7.6 Token Caching

- In-memory only (never persisted to disk)
- 5-minute buffer before expiry (TOKEN_BUFFER_MS = 300000)
- Pending token refresh promise prevents concurrent token requests

### 7.7 Input Sanitization

OData injection prevention:
- `sanitizeIdentifier()` - Regex `[a-zA-Z_][a-zA-Z0-9_]*`
- `sanitizeGuid()` - GUID format validation
- `escapeODataString()` - Single quote doubling

### 7.8 Error Handling

| HTTP Status | Behavior | Retried |
|-------------|----------|---------|
| 2xx | Success | No |
| 401 | Clear token cache, retry once | Yes (1x) |
| 429 | Respect Retry-After, separate counter | Yes (up to 10x) |
| 5xx | Exponential backoff | Yes (up to maxRetries) |
| 404, 403 | Non-retryable | No |
| Network error | Exponential backoff | Yes |

---

## 8. Authentication

### 8.1 Credential Factory

`createCredential(config: AuthConfig)` returns a `TokenCredential` (from @azure/identity) based on the auth method:

### 8.2 Four Auth Flows

| Method | Config | @azure/identity Class | Use Case |
|--------|--------|-----------------------|----------|
| client-credentials | tenantId, clientId, clientSecret | ClientSecretCredential | CI/CD, automated pipelines |
| interactive | tenantId, clientId? | InteractiveBrowserCredential | Developer workstation |
| device-code | tenantId, clientId? | DeviceCodeCredential | Headless CLI environments |
| token | token (string) | StaticTokenCredential | Pre-acquired tokens (e.g. from TokenVault) |

### 8.3 Token Scope

All auth flows request the scope: `{environmentUrl}/.default`

---

## 9. Testing Framework

### 9.1 createFormMock

```typescript
import { createFormMock } from '@xrmforge/testing';
import type { AccountMainForm, AccountMainFormMockValues } from '../typings/forms/account';

const mock = createFormMock<AccountMainForm, AccountMainFormMockValues>({
  name: 'Contoso Ltd',
  statuscode: 0,
  revenue: 1000000,
});

// Use in tests:
onLoad(mock.executionContext);
expect(mock.formContext.getControl('revenue').getVisible()).toBe(true);
```

**What it mocks:**
- Attributes: MockAttribute instances with getValue/setValue, dirty tracking, onChange handlers, required level, submit mode
- Controls: MockControl instances with visible/disabled/label/notification state
- UI: Form notifications, tab/section stubs
- Entity: ID, entity name, primary attribute
- Data: refresh(), save() stubs returning Promise-like
- Navigation: openForm/openAlertDialog stubs

**Lazy initialization:** Attributes accessed via `getAttribute()` that were not in the initial values are created on-the-fly with null value.

### 9.2 fireOnChange

```typescript
mock.fireOnChange('statuscode');
// Triggers all handlers registered via getAttribute('statuscode').addOnChange(handler)
```

Creates a MockEventContext with the attribute as event source.

### 9.3 setupXrmMock / teardownXrmMock

```typescript
import { setupXrmMock, teardownXrmMock } from '@xrmforge/testing';

beforeEach(() => setupXrmMock());
afterEach(() => teardownXrmMock());

// With WebApi overrides:
setupXrmMock({
  webApiOverrides: {
    retrieveMultipleRecords: async () => ({ entities: [{ name: 'Test' }] }),
  },
});
```

Sets up a global `Xrm` object on `globalThis` with minimal WebApi, Navigation, and Utility stubs.

---

## 10. ESLint Plugin

### 10.1 Installation

```javascript
// eslint.config.js (flat config, ESLint v9)
import xrmforge from '@xrmforge/eslint-plugin';

export default [
  xrmforge.configs.recommended,
  // or pick individual rules
];
```

### 10.2 Rules

#### no-xrm-page (error)

Forbids the deprecated `Xrm.Page` API (removed in D365 v9.0+).

```typescript
// Bad
Xrm.Page.getAttribute("name");

// Good
const form = executionContext.getFormContext();
form.getAttribute("name");
```

#### no-magic-optionset (warn)

Forbids raw numbers (>= 2) in comparisons with `.getValue()`.

```typescript
// Bad
if (attr.getValue() === 595300000) { }

// Good
import { StatusCode } from '../typings/optionsets/account';
if (attr.getValue() === StatusCode.Active) { }
```

#### no-sync-webapi (error)

Forbids synchronous XMLHttpRequest (`new XMLHttpRequest()` and `.open()` with `async=false`).

```typescript
// Bad
xhr.open("GET", url, false);

// Good
const data = await Xrm.WebApi.retrieveRecord("account", id);
```

#### require-error-handling (warn)

Requires try/catch in exported async functions starting with "on" (event handlers).

```typescript
// Bad
export async function onLoad(ctx) {
  await fetch("/api");  // no error handling
}

// Good
export async function onLoad(ctx) {
  try { await fetch("/api"); }
  catch (error) { console.error(error); }
}
```

#### require-namespace (warn)

Forbids direct `window.X = ...` or `globalThis.X = ...` assignments. Module exports with esbuild globalName should be used instead.

```typescript
// Bad
window.Contoso = { onLoad: function() {} };

// Good
export function onLoad(ctx: Xrm.Events.EventContext) {}
```

---

## 11. AGENT.md System

### 11.1 Purpose

The AGENT.md is a scaffolded file that teaches AI coding assistants (Claude, ChatGPT, Copilot, Cursor) how to write optimal D365 form scripts using XrmForge. It is generated by `xrmforge init` and placed in the project root.

### 11.2 Content Structure

1. **Package overview** - What each @xrmforge package does
2. **10 Rules: Always** - Fields Enum, OptionSet Enum, FormContext cast, EntityNames, parseLookup, select, createFormMock, module exports, Tabs/Sections enums, error handling
3. **Rules: Never** - Raw strings, magic numbers, Xrm.Page, sync XHR, eval, window assignments
4. **Before/After examples** - Field access, OptionSet comparison, testing
5. **Pattern Recognition table** - Legacy pattern to XrmForge replacement mapping
6. **OptionSet Enum creation guide** - How to create enums from magic numbers in legacy code
7. **Testing with setupXrmMock** - Global Xrm mock pattern
8. **Build commands** - xrmforge build, watch mode
9. **@types/xrm Pitfalls** - Known issues and workarounds
10. **File structure** - Expected project layout

### 11.3 Template System

The AGENT.md is stored as `src/scaffold/templates/AGENT.md` in the devkit package and loaded via `template-loader.ts` at scaffold time. No variable substitution needed (the file is static).

### 11.4 KI Comparison Test Results

Five AI models were tested converting legacy D365 JavaScript (account.js + lm_helper.js, 1,288 lines) to TypeScript with XrmForge:

| Rank | Model | Score | Tool | Strength |
|------|-------|-------|------|----------|
| 1 | Claude Opus 4.6 | 42/50 | Claude Code | Most tests (62), best code structure |
| 2 | Claude Sonnet 4.6 | 41/50 | Claude Code | Most bugs found (5), best DI approach |
| 3 | Cursor Composer 2 | 35/50 | Cursor IDE | Recognized select() Node API issue |
| 4 | ChatGPT GPT-4o | 30/50 | ChatGPT Web | Functional but less XrmForge-specific |
| 5 | MS Copilot | 12/50 | Browser Chat | No workspace access, never saw AGENT.md |

**Criteria (11, max 5 points each = 55 max):** Fields Enum usage, OptionSet Enums, FormContext typing, XrmForge helpers, module exports, tests present, test quality, error handling, code quality, bugs found, documentation.

**Key finding:** No AI consistently used `@xrmforge/typegen/helpers` imports (select, parseLookup). This remains the biggest adoption gap.

---

## 12. @types/xrm Pitfalls

Known issues when working with `@types/xrm`:

| Issue | Wrong | Correct |
|-------|-------|---------|
| Form interface | `interface extends Xrm.FormContext` | `extends Omit<Xrm.FormContext, 'getAttribute' \| 'getControl'>` |
| AlertDialogResponse | `Xrm.Navigation.AlertDialogResponse` | `Xrm.Async.PromiseLike<void>` (type does not exist) |
| ConfirmDialogResponse | `Xrm.Navigation.ConfirmDialogResponse` | `Xrm.Navigation.ConfirmResult` (type does not exist) |
| setNotification | `setNotification(message)` | `setNotification(message, uniqueId)` (requires 2 args) |
| openFile | `openFile({ fileName, ... })` | Must include `fileSize` property in FileDetails |
| SubmitMode | `Xrm.Attributes.SubmitMode` | `Xrm.SubmitMode` |
| const enum in .d.ts | `const enum` in `.d.ts` files | Use regular `enum` in `.ts` files (vitest cannot import const enums from .d.ts) |
| Grid.refresh() | `grid.refresh()` | `(grid as any).refresh()` (not typed in @types/xrm) |

---

## 13. typegen/helpers Subpath

### 13.1 Problem

Importing from the main `@xrmforge/typegen` entry point pulls in Node.js dependencies (`fs`, `path`, `@azure/identity`). This breaks esbuild browser bundles:

```typescript
// WRONG - pulls in Node.js deps, breaks esbuild
import { select, parseLookup } from '@xrmforge/typegen';
```

### 13.2 Solution

The `/helpers` subpath exports only browser-safe code with zero Node.js dependencies:

```typescript
// CORRECT - browser-safe, no Node.js deps
import { select, parseLookup } from '@xrmforge/typegen/helpers';
```

### 13.3 Exports

**Web API Helpers:**
- `select(...fields: string[]): string` - Builds `?$select=field1,field2`
- `selectExpand(fields: string[], expand: string): string` - Builds `?$select=...&$expand=...`
- `parseLookup(response: Record<string, unknown>, fieldName: string): LookupValue | null` - Parses `_fieldname_value` with OData annotations
- `parseLookups(response: Record<string, unknown>, fieldName: string): LookupValue[]` - Multi-value lookup parsing
- `parseFormattedValue(response: Record<string, unknown>, fieldName: string): string | null` - Extracts `@OData.Community.Display.V1.FormattedValue`

**Xrm Constants (8 const enums):**
- DisplayState, FormNotificationLevel, RequiredLevel, SubmitMode, SaveMode, ClientType, ClientState, OperationType

### 13.4 Adoption Gap

Despite being documented in the AGENT.md Pattern Recognition table, no AI coding assistant consistently uses the `/helpers` imports. This is the biggest remaining gap in XrmForge's AI-driven code generation.

---

## 14. Showcases

### 14.1 Markant WebResources (Production Showcase)

Located in the XrmForge-Workspace repository under `docs/07_showcase/markant-webresources/`.

- **30 WebResources** in `src/forms/` (account, contact, opportunity, lead, quote, email, task, etc.)
- **1 shared library** (GDPR retention UI)
- **9 test files** with 59 tests
- **79 generated typings:** 25 form interfaces, 28 entity interfaces, 22 OptionSet files, 4 action executors
- **esbuild build** via xrmforge.config.json (32 entries)
- **Deploy script** (deploy.mjs) with @azure/identity auth, incremental deployment, hash-based change detection
- **27 entities, 236 OptionSet enums, 95 form interfaces, 7 Custom API executors**

### 14.2 LMApp WebResources (KI Comparison Showcase)

Created during the KI comparison tests (Session 9). 18 legacy JavaScript form scripts (~8,400 lines) converted to TypeScript with XrmForge patterns.

- **19 WebResources** with Fields Enums, EntityNames, OptionSet Enums
- **84 tests** in 8 test files
- **XrmForge-optimized:** All 10 AGENT.md rules applied (FormContext cast, Fields Enum, EntityNames, OptionSet Enums, shared getLookupObject, Tab Enums)

---

## 15. CI/CD

### 15.1 GitHub Actions CI (`.github/workflows/ci.yml`)

**Triggers:** Push to main, Pull Requests against main.

**Matrix:** Node 20, Node 22 on ubuntu-latest.

**Steps:**
1. Checkout
2. Setup pnpm (from packageManager field)
3. Setup Node.js (matrix version)
4. `pnpm install --frozen-lockfile`
5. `pnpm lint`
6. `pnpm -r exec tsc --noEmit` (typecheck all packages)
7. `pnpm build`
8. `pnpm test`
9. Coverage (Node 22 only): `npx vitest run --coverage` in typegen

### 15.2 Release Workflow (`.github/workflows/release.yml`)

**Triggers:** After successful CI on push to main.

**Steps:**
1. Checkout, setup pnpm, setup Node 22
2. `pnpm install --frozen-lockfile`
3. `pnpm build`
4. Changesets action: creates Release PR or publishes to npm

**Publish command:** `pnpm release` = `turbo run build && changeset publish`

### 15.3 Turbo Pipeline

```
build:      dependsOn: [^build], outputs: [dist/**]
test:       dependsOn: [build]
typecheck:  dependsOn: [^build]
lint:       (no dependencies)
dev:        cache: false, persistent: true
clean:      cache: false
```

### 15.4 Changesets

Configured for public npm access, auto-update internal dependencies on patch level. Publish requires NPM_TOKEN secret.

### 15.5 Publishing Order

Due to internal dependencies: typegen first, then devkit, then cli. Must use `pnpm publish` (not `npm publish`) to resolve `workspace:*` references to real versions.

---

## 16. Technical Debt

### 16.1 Known Issues

| Issue | Status | Priority |
|-------|--------|----------|
| parseLookup/select not adopted by AI assistants | Open | High |
| release.yml double runs (CI triggers release, release re-triggers CI) | Open | Low |
| No integration tests against live Dataverse | Open (OE-4) | Medium |
| @xrmforge/webapi has no Action/Function support | Accepted | Low |
| devDependency versions in scaffolded package.json are pinned to old versions | Open | Low |

### 16.2 Accepted Limitations

- **const enum limitation:** Cannot be imported at runtime by test frameworks from `.d.ts` files. Workaround: use `.ts` files with regular `enum` for manual typings.
- **Grid.refresh() requires `as any`:** Not typed in @types/xrm.
- **Single solution per entity:** If an entity appears in multiple solutions, it is only generated once.

---

## 17. Roadmap

### 17.1 Next Steps (Priority Order)

1. **parseLookup/select Adoption** - Improve AGENT.md examples so AI assistants consistently use `/helpers` imports
2. **LMApp Showcase regeneration** - With latest releases (testing@0.2.0, devkit@0.4.0 with improved AGENT.md)
3. **KI Battle Round 3** - Re-test Sonnet vs Opus after improvements to measure progress
4. **Documentation website** - xrmforge.dev or xrmforge.io (OE-3)

### 17.2 Open Decisions

| ID | Decision | Status |
|----|----------|--------|
| OE-1 | npm scope availability (@xrmforge) | Open |
| OE-2 | GitHub org vs personal repo | Decided: personal (juergenbeck/XrmForge) |
| OE-3 | Documentation domain (xrmforge.dev or .io) | Open |
| OE-4 | Dataverse test environment for integration tests | Open |
| OE-5 | Publisher prefix and solution name for PCF/WebResource tests | Open |

### 17.3 Future Possibilities

- Relationship Names const enum (OE-7, low priority)
- @xrmforge/webapi with Action/Function support (reuse DataverseHttpClient)
- Plugin system for custom generators and type mappings
- Server-side generation (Custom API in Dataverse)

---

## 18. Design Principles

The 18 design principles that govern all XrmForge development:

1. **Extend, don't replace** - Types build on @types/xrm, never override them.
2. **TypeScript all the way** - 100% TypeScript-native. No .NET, no ADAL.
3. **Code must build** - Every work step ends with green build + tests.
4. **Research before speed** - Investigate, compare, decide, then implement. Never guess.
5. **No module without basics** - Error handling, logging, unit tests, JSDoc on all public APIs.
6. **Monorepo discipline** - Each package standalone, no circular deps, barrel exports.
7. **Enterprise resilience** - Retry + exponential backoff, rate-limit awareness, token caching, read-only default.
8. **esbuild-first, webpack-compatible** - Default: esbuild (fast). webpack stays supported. IIFE output for D365.
9. **MSAL-only authentication** - Only @azure/identity (no legacy ADAL). Three flows: client credentials, browser, device code.
10. **Review required** - After every step, immediate critical review (6 dimensions). No asking if review is wanted.
11. **Session state required** - session-state.md updated, changelog written, open questions tracked.
12. **No half measures** - Every step completed fully: green build + tests + review before next step.
13. **Informed architecture decisions** - Research, compare, recommend with pros/cons, get decision, persist.
14. **Abstraction over vendor lock-in** - External dependencies behind interfaces (parser, auth, bundler).
15. **Dual-language labels** - Primary language (1033/English) for identifiers, secondary in JSDoc. German umlauts transliterated.
16. **Review with research and live verification** - Internet research, live D365 verification, production code checks, cite sources.
17. **Challenge postponement** - "Later" check: Will it get harder? API contract? Real effort? Technical reasons?
18. **Read-only default for Dataverse access** - DataverseHttpClient defaults to readOnly: true. Write access is an explicit opt-in.
