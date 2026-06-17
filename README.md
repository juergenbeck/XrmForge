# XrmForge

[Auf Deutsch lesen](README.de.md)

**Type-safe TypeScript for Dynamics 365 CE / Model-Driven Apps.**

XrmForge reads your Dataverse metadata and generates TypeScript declarations that turn runtime errors into compile-time errors, so you catch mistakes before they reach production.

---

## Table of Contents

- [1. What is XrmForge?](#1-what-is-xrmforge)
- [2. Features](#2-features)
- [3. Prerequisites](#3-prerequisites)
- [4. Quick Start (5 Minutes)](#4-quick-start-5-minutes)
- [5. Project Structure](#5-project-structure)
- [6. Generating Types](#6-generating-types)
  - [CLI Reference](#cli-reference)
  - [Authentication](#authentication)
  - [Azure App Registration](#azure-app-registration)
  - [Config File](#config-file)
- [7. Using Generated Types](#7-using-generated-types)
  - [tsconfig.json](#tsconfigjson)
  - [Writing a Form Script](#writing-a-form-script)
  - [Web API Queries with Fields Enum](#web-api-queries-with-fields-enum)
  - [Custom Action Executors](#custom-action-executors)
- [8. Building for D365](#8-building-for-d365)
  - [Why IIFE?](#why-iife)
  - [Option A: xrmforge build (recommended)](#option-a-xrmforge-build-recommended)
  - [Option B: Manual build.mjs](#option-b-manual-buildmjs)
  - [Shared Libraries](#shared-libraries)
- [9. Deploying to D365](#9-deploying-to-d365)
- [10. Debugging](#10-debugging)
- [11. Common Patterns](#11-common-patterns)
- [12. Packages](#12-packages)
- [13. For Framework Developers](#13-for-framework-developers)
- [14. Troubleshooting](#14-troubleshooting)
- [15. Roadmap](#15-roadmap)
- [16. License](#16-license)

---

## 1. What is XrmForge?

XrmForge generates type-safe TypeScript declarations from your Dynamics 365 environment. It extends `@types/xrm` (never replaces it), so your generated types work alongside PCF controls, third-party libraries, and the entire Microsoft ecosystem.

**Before XrmForge** (raw JavaScript, no safety net):

```typescript
const formContext = executionContext.getFormContext();
formContext.getAttribute("telephon1").setValue("test");  // Typo! Returns null, .setValue() crashes with TypeError
formContext.getAttribute("revenue").getValue();           // Field not on Quick Create form, crashes at runtime

// 12 lines of boilerplate for one Custom Action call
const request = {
  getMetadata: () => ({
    boundParameter: 'entity',
    parameterTypes: { entity: { typeName: 'mscrm.quote', structuralProperty: 5 } },
    operationName: 'contoso_winquote', operationType: 0,
  }),
  entity: { id: recordId, entityType: 'quote' },
};
await (Xrm.WebApi as any).online.execute(request);
```

**After XrmForge** (three levels of type safety):

```typescript
// Level 1: Typed getAttribute with Fields enum
const formContext = executionContext.getFormContext() as AccountForm;
const name = formContext.getAttribute(Fields.AccountName);  // StringAttribute, not generic
name.setValue(123);                                          // Compile error!
formContext.getAttribute("naem");                             // Compile error!

// Level 2: TypedForm with direct member access (zero boilerplate)
const form = typedForm<AccountFormTypeInfo>(formContext);
form.name.setValue("Contoso Ltd");                // Direct property access
form.revenue.setValue(1000000);                   // NumberAttribute, typed
form.industrycode.setValue(IndustryCode.Finance); // OptionSet enum, not magic number

// Level 3: Generated Custom Action executors (1 line instead of 12)
import { WinQuote } from '../generated/actions/quote';
const response = await WinQuote.execute(recordId);  // Fully typed, no raw strings

// With typed parameters and response
import { ValidateMandatoryFields } from '../generated/actions/global';
const result = await ValidateMandatoryFields.execute({
  TargetId: opportunityId,     // string (typed as Guid)
  RuleSet: 'Unified_Fullversion',
  Language: 'de',
});
if (!result.IsValid) {         // boolean (typed)
  alert(result.MessageDe);     // string (typed)
}
```

Every field, every form, every Custom API becomes a compile-time contract. Typos, wrong types, missing fields, and incorrect action parameters are caught by the TypeScript compiler, not by a tester clicking through forms.

---

## 2. Features

- **Entity Interfaces** -- Typed Web API response objects with all attributes correctly typed (string, number, boolean, Lookup, OptionSet, DateTime).
- **Form Interfaces** -- Per-form `getAttribute()` and `getControl()` overloads. Only fields that actually exist on the form are valid. No string fallback, no `any`.
- **OptionSet Enums** -- Every picklist, status, and state field becomes a `const enum`. Zero runtime overhead (values are inlined by TypeScript).
- **Fields Enums** -- `const enum` with all entity fields for type-safe `$select` queries via the Web API.
- **Navigation Properties** -- `const enum` for lookup field navigation property names, used with `parseLookup()` and `$expand`.
- **Action/Function Executors** -- Generated from Custom API metadata. Type-safe parameters and responses, with `execute()` and `request()` (for `executeMultiple` batching).
- **Web API Helpers** -- `select()`, `parseLookup()`, `parseFormattedValue()`, `withProgress()`, `callCloudFlow()`, and more.
- **Xrm Constants** -- `DisplayState`, `FormNotificationLevel`, `RequiredLevel`, `SubmitMode`, `SaveMode`, `ClientType`, `OperationType`, and others as `const enum`. No more raw strings.
- **Dual-Language Labels** -- JSDoc comments show both languages: `/** Account Name | Firmenname */`. Autocomplete in VS Code shows both.
- **Form Testing** -- `@xrmforge/testing` package: type-safe mock builder for D365 form scripts. `createFormMock<AccountForm>({ name: 'Contoso' })` creates a compile-time validated mock with `getAttribute()`, `getControl()`, `ui.setFormNotification()`, and event context support. No more `as any` casts.
- **Incremental Generation** -- `--cache` flag enables metadata caching. Only re-fetches entities whose metadata has changed since the last run, using Dataverse's `RetrieveMetadataChanges` delta detection. First run: full refresh. Subsequent runs: 10x faster.
- **Build Orchestration** -- `xrmforge build` produces IIFE bundles from a declarative config. No esbuild config files needed. `xrmforge build --watch` for incremental rebuilds (~10ms). Powered by `@xrmforge/devkit`.

---

## 3. Prerequisites

If you have never worked with Node.js or TypeScript before, follow every step below. If you already have a working setup, skip to [Quick Start](#4-quick-start-5-minutes).

### Git

Download and install from [https://git-scm.com](https://git-scm.com). After installation, verify:

```bash
git --version
# git version 2.44.0 (or higher)
```

### Node.js (version 20 or higher)

Download the LTS version from [https://nodejs.org](https://nodejs.org). The installer includes `npm` (the package manager). After installation, verify both:

```bash
node --version
# v20.11.0 (or higher)

npm --version
# 10.2.0 (or higher)
```

### VS Code (recommended)

Download from [https://code.visualstudio.com](https://code.visualstudio.com). Install the following extensions for the best experience:

- **ESLint** (`dbaeumer.vscode-eslint`) -- catches errors as you type
- **TypeScript Importer** -- auto-imports for generated types

### A Dynamics 365 CE Environment

You need admin access (or at least read access to entity metadata) to the Dataverse environment you want to generate types for.

### Authentication (one of these)

XrmForge supports multiple authentication methods. For Interactive and Device Code, you can use Microsoft's well-known sample App ID (`51f81489-12ee-4a9e-aaae-a2591f45987d`), so no own App Registration is required to get started:

- **Interactive Browser** (recommended for getting started): Opens a browser, you sign in. Works with the Microsoft sample App ID, no own App Registration needed.
- **Device Code**: Displays a code you enter at microsoft.com/devicelogin. Works on headless terminals. Also works with the sample App ID.
- **Client Credentials**: Service Principal with client secret. For CI/CD pipelines. Requires your own App Registration with admin consent.
- **Token**: Pass a pre-acquired Bearer token. No App Registration needed.

Your Tenant ID can be found at [whatismytenantid.com](https://www.whatismytenantid.com) by entering your domain name.

See [Authentication](#authentication) and [Azure App Registration](#azure-app-registration) below for details.

---

## 4. Quick Start (5 Minutes)

This takes you from zero to generated types. Every command is copy-paste ready.

**Step 1: Create a project folder and initialize it.**

```bash
mkdir my-d365-project
cd my-d365-project
npm init -y
```

**Step 2: Install XrmForge and development dependencies.**

```bash
npm install --save-dev @xrmforge/cli @types/xrm typescript esbuild
```

**Step 3: Generate types from your environment.**

Replace `YOUR_TENANT_ID` with your Azure AD tenant ID (see [Authentication](#authentication) for how to find it). The client ID below is Microsoft's well-known sample App ID, so no own App Registration is needed.

```bash
npx xrmforge generate \
  --url https://myorg.crm4.dynamics.com \
  --auth interactive \
  --tenant-id YOUR_TENANT_ID \
  --client-id 51f81489-12ee-4a9e-aaae-a2591f45987d \
  --entities account,contact,opportunity \
  --output ./generated \
  --secondary-language 1031
```

This opens a browser window for authentication, reads entity metadata, and writes `.ts` files into `./generated/`. The `--secondary-language 1031` adds German labels as JSDoc comments (optional).

**Step 4: Set up TypeScript.**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "types": ["xrm"],
    "strict": true,
    "noEmit": true
  },
  "include": [
    "src/**/*.ts",
    "generated/**/*.ts"
  ]
}
```

**Step 5: Write your first form script.**

Create `src/forms/account-form.ts`:

```typescript
import type { AccountAccountForm as AccountForm } from '../../generated/forms/account.js';
import { AccountAccountFormFieldsEnum as Fields } from '../../generated/forms/account.js';

export function onLoad(executionContext: Xrm.Events.EventContext): void {
  const formContext = executionContext.getFormContext() as AccountForm;

  const name = formContext.getAttribute(Fields.AccountName);
  if (!name.getValue()) {
    formContext.ui.setFormNotification(
      "Account name is required.",
      "WARNING",
      "name-warning",
    );
  }
}
```

**Step 6: Type-check.**

```bash
npx tsc --noEmit
```

If this passes with zero errors, your types are working. Continue to [Building for D365](#8-building-for-d365-esbuild) to produce uploadable `.js` files.

---

## 5. Project Structure

A typical D365 TypeScript project using XrmForge:

```
my-d365-project/
  src/
    forms/              # One .ts file per form event handler
      account-form.ts
      contact-form.ts
    shared/             # Shared utility libraries (e.g. GDPR helpers)
      notifications.ts
  generated/            # Generated by XrmForge (do not edit manually)
    entities/           # Entity data interfaces (for Web API responses)
    forms/              # Typed FormContext per entity/form
    optionsets/         # OptionSet const enums
    fields/             # Entity Fields enums for $select queries
    actions/            # Custom API executors (.ts)
    index.ts            # Barrel file with export * from re-exports
  dist/                 # Build output (IIFE .js files for D365 upload)
  tsconfig.json         # TypeScript configuration
  build.mjs             # esbuild build script
  xrmforge.config.json  # Optional: XrmForge CLI configuration
  package.json
```

The `generated/` directory is fully re-creatable by running the generator again. You can either commit it to source control (so CI does not need Dataverse access) or add it to `.gitignore` and generate on demand.

---

## 6. Generating Types

### CLI Reference

```bash
npx xrmforge generate [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `--url <url>` | Dataverse environment URL (e.g. `https://myorg.crm4.dynamics.com`). Falls back to `XRMFORGE_URL` | Required |
| `--auth <method>` | Authentication method: `interactive`, `client-credentials`, `device-code`, `token` | Required |
| `--tenant-id <id>` | Azure AD tenant ID. Falls back to `XRMFORGE_TENANT_ID` | Required for most auth methods |
| `--client-id <id>` | Azure AD application (client) ID. Falls back to `XRMFORGE_CLIENT_ID` | Required for most auth methods |
| `--client-secret <secret>` | Client secret (for `client-credentials` only). Prefer the `XRMFORGE_CLIENT_SECRET` env var | -- |
| `--token <token>` | Pre-acquired Bearer token (for `token` auth). Prefer `XRMFORGE_TOKEN` env var | -- |
| `--entities <list>` | Comma-separated entity logical names (e.g. `account,contact,opportunity`) | -- |
| `--solutions <list>` | Comma-separated solution unique names (discovers all entities in those solutions) | -- |
| `--output <dir>` | Output directory for generated files | `./generated` |
| `--label-language <code>` | Primary label language LCID | `1033` (English) |
| `--secondary-language <code>` | Secondary label language LCID (for dual-language JSDoc) | -- |
| `--no-forms` | Skip form interface generation | Forms enabled |
| `--no-optionsets` | Skip OptionSet enum generation | OptionSets enabled |
| `--actions` | Generate typed Custom API Action/Function executors | Off |
| `--actions-filter <prefix>` | Filter Custom APIs by unique name prefix (e.g. `markant_`) | -- |
| `--cache` | Enable metadata caching for incremental generation (10x faster) | Off |
| `--no-cache` | Force full metadata refresh (ignore cache) | -- |
| `--cache-dir <dir>` | Directory for metadata cache files | `.xrmforge/cache` |
| `--check` | Drift check: compare against the output directory without writing. Exit 0 = up to date, 1 = error, 2 = drift | Off |
| `-v, --verbose` | Enable verbose/debug logging | Off |

Either `--entities` or `--solutions` must be specified (or both). When using `--solutions`, XrmForge discovers all entities in those solutions. Multiple solutions are merged, duplicates removed.

### Drift Detection (`--check`)

Generated files are a snapshot of your Dataverse environment. When the environment changes afterwards (a Custom API parameter is recreated with a different type, a field is added, an option set value changes), the checked-in files silently drift: TypeScript still compiles, tests against mocks stay green, and the mismatch only surfaces at runtime as a cryptic OData error.

`xrmforge generate --check` makes that drift visible: it runs the full generation in-memory and compares the result byte-by-byte against the output directory **without writing anything** (no output files, no cache). The report is grouped by category (Entities, Fields, Forms, OptionSets, Actions) with one of three drift classes per file: `changed`, `missing`, or `orphaned` (the object was deleted in Dataverse). Manual edits to generated files are detected as `changed` too.

Exit codes follow the `terraform plan -detailed-exitcode` / `prisma migrate diff --exit-code` convention:

| Exit code | Meaning |
|---|---|
| `0` | Generated files are up to date |
| `1` | Error (authentication, network, configuration) |
| `2` | Drift detected |

Typical CI step (nightly or per pipeline run). Connection and credentials come from
`XRMFORGE_*` environment variables (see [Authentication](#authentication)), so no secret
appears on the command line:

```bash
# env: XRMFORGE_URL, XRMFORGE_TENANT_ID, XRMFORGE_CLIENT_ID, XRMFORGE_CLIENT_SECRET
npx xrmforge generate \
  --auth client-credentials \
  --solutions MySolution --actions \
  --output ./generated --check
```

Notes on the byte comparison:

1. **After a typegen/cli upgrade**, the newer generator may produce different output without any environment change. Expected reaction: regenerate and commit.
2. **Do not post-process `generated/`** with formatters (Prettier) or lint autofixes — that changes content and is reported as real drift. Line endings are *not* drift: `--check` compares with line endings normalized, so a CRLF working copy (git `core.autocrlf`, the Windows default) does not turn the check red. Scaffolded projects (`xrmforge init`) also ship a `.gitattributes` pinning `generated/**` to `eol=lf` for clean diffs.

### Authentication

Three methods are supported, all powered by `@azure/identity` (MSAL). A fourth method (`token`) allows passing a pre-acquired Bearer token.

**How to find your Tenant ID:** Open `https://login.microsoftonline.com/YOUR_EMAIL_DOMAIN/.well-known/openid-configuration` in a browser (use your email domain like `contoso.com`, not the CRM URL). The tenant ID is in the `issuer` field: `https://sts.windows.net/{TENANT_ID}/`.

**Client ID:** For Interactive and Device Code, use Microsoft's well-known sample App ID: `51f81489-12ee-4a9e-aaae-a2591f45987d`. No own App Registration needed. For Client Credentials (CI/CD), you need your own App Registration (see [Azure App Registration](#azure-app-registration)).

**Interactive (developer laptop, opens browser)**

Best for local development. Opens a browser window for you to sign in.

```bash
npx xrmforge generate \
  --url https://myorg.crm4.dynamics.com \
  --auth interactive \
  --tenant-id YOUR_TENANT_ID \
  --client-id 51f81489-12ee-4a9e-aaae-a2591f45987d \
  --entities account,contact \
  --output ./generated
```

**Client Credentials (CI/CD, Service Principal)**

Best for automated pipelines. Uses a client secret, no user interaction. Requires your own App Registration (see [Azure App Registration](#azure-app-registration)).

```bash
npx xrmforge generate \
  --url https://myorg.crm4.dynamics.com \
  --auth client-credentials \
  --tenant-id YOUR_TENANT_ID \
  --client-id YOUR_OWN_APP_ID \
  --client-secret YOUR_SECRET \
  --entities account,contact \
  --output ./generated
```

In CI/CD, supply the secret (and the rest of the connection) via `XRMFORGE_*` environment
variables instead of command-line flags, so the secret never reaches the shell history or
the process list:

```bash
# env: XRMFORGE_URL, XRMFORGE_TENANT_ID, XRMFORGE_CLIENT_ID, XRMFORGE_CLIENT_SECRET
npx xrmforge generate --auth client-credentials --entities account,contact --output ./generated
```

**Device Code (headless terminal, SSH sessions)**

Best for remote servers without a browser. Displays a code you enter at https://microsoft.com/devicelogin.

```bash
npx xrmforge generate \
  --url https://myorg.crm4.dynamics.com \
  --auth device-code \
  --tenant-id YOUR_TENANT_ID \
  --client-id 51f81489-12ee-4a9e-aaae-a2591f45987d \
  --entities account,contact \
  --output ./generated
```

**Token (pre-acquired Bearer token)**

For environments where you acquire tokens externally. Prefer the `XRMFORGE_TOKEN` environment variable over the `--token` flag to avoid exposing the token in shell history.

```bash
export XRMFORGE_TOKEN="eyJ0eXAiOi..."

npx xrmforge generate \
  --url https://myorg.crm4.dynamics.com \
  --auth token \
  --entities account,contact \
  --output ./generated
```

| Method | Use Case | Required Flags |
|--------|----------|----------------|
| `interactive` | Local development (opens browser) | `--tenant-id`, `--client-id` |
| `client-credentials` | CI/CD pipelines (Service Principal) | `--tenant-id`, `--client-id`, `--client-secret` |
| `device-code` | Headless terminals | `--tenant-id`, `--client-id` |
| `token` | External token provider | `XRMFORGE_TOKEN` env var or `--token` |

#### Environment variables

Connection and credentials also resolve from environment variables, so CI pipelines (and
local shells) can avoid putting secrets on the command line:

| Variable | Replaces flag |
|----------|---------------|
| `XRMFORGE_URL` | `--url` |
| `XRMFORGE_TENANT_ID` | `--tenant-id` |
| `XRMFORGE_CLIENT_ID` | `--client-id` |
| `XRMFORGE_CLIENT_SECRET` | `--client-secret` |
| `XRMFORGE_TOKEN` | `--token` |

The same variables can live in a local **`.env`** file next to `xrmforge.config.json`;
`generate` loads it automatically (a real environment variable still wins over `.env`). And
in an **interactive terminal**, if a required value is still missing, `generate` prompts for
it (secret input is hidden) and offers to save the entered values to `./.env` (chmod 600 on
POSIX) for next time. In a non-interactive context (CI) nothing is prompted; the usual
missing-value error fires instead. `xrmforge init` adds `.env` to `.gitignore`.

Resolution precedence per value is: explicit CLI flag, then the environment variable, then
`./.env`, then `xrmforge.config.json`, and finally the interactive prompt. Put non-secret
connection defaults (URL, tenant, client, label languages, scope) in `xrmforge.config.json`;
keep the client secret out of the repo and supply it only via `XRMFORGE_CLIENT_SECRET` or a
git-ignored `.env` (the secret is never read from the config file).

### Azure App Registration

If you do not have an App Registration yet, follow these steps in the Azure Portal:

1. Go to [https://portal.azure.com](https://portal.azure.com) and sign in.
2. Navigate to **Azure Active Directory** (or **Microsoft Entra ID**), then **App registrations**, then **New registration**.
3. Fill in:
   - **Name:** `XrmForge Type Generator` (or any name you prefer)
   - **Supported account types:** Single tenant (your organization only)
   - **Redirect URI:** Select "Mobile and desktop applications" and add `http://localhost` (needed for interactive auth)
4. Click **Register**.
5. On the app overview page, copy:
   - **Application (client) ID** -- this is your `--client-id`
   - **Directory (tenant) ID** -- this is your `--tenant-id`
6. Go to **API permissions**, click **Add a permission**.
   - Select **Dynamics CRM**.
   - Check **user_impersonation**.
   - Click **Add permissions**.
   - If you have admin rights, click **Grant admin consent** (otherwise ask your admin).
7. For CI/CD with `client-credentials`:
   - Go to **Certificates & secrets**, click **New client secret**.
   - Copy the secret value immediately (it is shown only once).
   - Store it securely (e.g. Azure Key Vault, GitHub Actions secret).
   - The Service Principal also needs an application user in Dataverse with the System Administrator role.

### Config File

Instead of passing all flags on the command line, you can create `xrmforge.config.json` in your project root:

```json
{
  "url": "https://myorg.crm4.dynamics.com",
  "auth": "interactive",
  "tenantId": "YOUR_TENANT_ID",
  "clientId": "YOUR_APP_ID",
  "entities": ["account", "contact", "opportunity"],
  "output": "./generated",
  "labelLanguage": 1033,
  "secondaryLanguage": 1031
}
```

CLI flags always take precedence over config file values. Never put `clientSecret` in this file; use environment variables instead.

With a config file, generation becomes:

```bash
npx xrmforge generate
```

---

## 7. Using Generated Types

### tsconfig.json

A working `tsconfig.json` for D365 projects:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "types": ["xrm"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": false
  },
  "include": [
    "src/**/*.ts",
    "generated/**/*.ts"
  ]
}
```

Key points:

- `"types": ["xrm"]` loads the global `Xrm` namespace from `@types/xrm`.
- `"strict": true` enables all strict checks. This is where XrmForge shines.
- The `include` array must cover both your source code and the generated types.

### Writing a Form Script

A complete, realistic form script:

```typescript
// src/forms/account-form.ts

// Import the form interface (generated per form)
import type { AccountAccountForm as AccountForm } from '../../generated/forms/account.js';

// Fields enum: autocomplete shows all fields on this form, with dual-language labels
import { AccountAccountFormFieldsEnum as Fields } from '../../generated/forms/account.js';

// OptionSet enum (generated from picklist metadata)
import { IndustryCode } from '../../generated/optionsets/account.js';

/**
 * onLoad handler for the Account main form.
 * Register in D365: Contoso.AccountForm.onLoad
 */
export function onLoad(executionContext: Xrm.Events.EventContext): void {
  const formContext = executionContext.getFormContext() as AccountForm;

  // getAttribute returns the exact type based on the field:
  const name = formContext.getAttribute(Fields.AccountName);
  // TypeScript knows: Xrm.Attributes.StringAttribute

  const creditLimit = formContext.getAttribute(Fields.CreditLimit);
  // TypeScript knows: Xrm.Attributes.NumberAttribute

  const creditHold = formContext.getAttribute(Fields.CreditHold);
  // TypeScript knows: Xrm.Attributes.BooleanAttribute

  const primaryContact = formContext.getAttribute(Fields.PrimaryContact);
  // TypeScript knows: Xrm.Attributes.LookupAttribute

  // Compile errors catch mistakes:
  // name.setValue(123);                   // Error: number is not assignable to string
  // formContext.getAttribute("naem");     // Error: "naem" is not in the fields union

  // Business logic with full type safety
  if (creditHold.getValue() === true) {
    const creditControl = formContext.getControl(Fields.CreditLimit);
    // TypeScript knows: Xrm.Controls.NumberControl
    creditControl.setDisabled(true);
  }
}
```

### Web API Queries with Fields Enum

The `select()` helper and entity-level `Fields` enum let you write type-safe Web API queries:

```typescript
import { select, parseLookup, parseFormattedValue } from '@xrmforge/helpers';
import { AccountFields } from '../../generated/fields/account.js';
import { AccountNavigationProperties as AccountNav } from '../../generated/entities/account.js';

async function loadAccountData(accountId: string): Promise<void> {
  // select() builds the OData $select query string
  const result = await Xrm.WebApi.retrieveRecord(
    "account",
    accountId,
    select(
      AccountFields.Name,
      AccountFields.Website,
      AccountFields.CreditLimit,
      AccountFields.PrimaryContact,
    ),
  );

  // Parse lookup fields from the response
  const contact = parseLookup(result, AccountNav.PrimaryContact);
  if (contact) {
    console.log(`Primary contact: ${contact.name} (${contact.entityType})`);
  }

  // Parse formatted values (display names for optionsets, dates, money)
  const industry = parseFormattedValue(result, "industrycode");
  // "Consulting" instead of 7
}
```

### Custom Action Executors

XrmForge generates type-safe executors for Custom APIs defined in your Dataverse environment:

```typescript
// Import the generated executor
import { NormalizePhone } from '../generated/actions/global';
import type { ContactContactForm } from '../generated/forms/contact.js';

async function normalizePhoneNumber(
  formContext: ContactContactForm,
): Promise<void> {
  const phone = formContext.getAttribute("telephone1").getValue();
  if (!phone) return;

  // Type-safe: TypeScript knows the parameter and response shapes
  const result = await NormalizePhone.execute({
    Input: phone,
    AllowSuspicious: false,
  });

  // result.Normalized, result.Status, result.Message are all typed
  if (result.Status === 1) {
    formContext.getAttribute("telephone1").setValue(result.Normalized);
  }
}
```

For bound actions (actions tied to a specific entity):

```typescript
import { WinQuote } from '../generated/actions/quote';
import { withProgress } from '@xrmforge/helpers';

async function winQuote(quoteId: string): Promise<void> {
  // withProgress shows a spinner and closes it on completion; errors propagate
  // to the handler wrapper (wrapHandler/wrapCommand), which owns the error UI
  await withProgress("Processing quote...", () =>
    WinQuote.execute(quoteId),
  );
}
```

### Calling a Power Automate cloud flow

`callCloudFlow()` is a typed wrapper for a cloud flow with an HTTP request trigger. It sends the body as JSON, returns the parsed response, and throws on a non-2xx status. The trigger URL carries a SAS signature, so pass it in from configuration rather than hard-coding it. Compose with `withProgress` for a spinner. (For a flow reached through a Custom API, use `createUnboundAction` instead.)

```typescript
import { callCloudFlow, withProgress } from '@xrmforge/helpers';

interface PriceRequest { quoteId: string; }
interface PriceResponse { total: number; currency: string; }

const price = await withProgress('Calculating price...', () =>
  callCloudFlow<PriceRequest, PriceResponse>(FLOW_URL, { quoteId }),
);
console.log(price.total, price.currency);
```

---

## 8. Building for D365

### Why IIFE?

Dynamics 365 loads Web Resources via `<script>` tags. Functions must be globally accessible so the form event handler system can call them by name (e.g. `Contoso.AccountForm.onLoad`). The IIFE (Immediately Invoked Function Expression) format wraps your module code and exposes it under a global namespace.

### Option A: `xrmforge build` (recommended)

Add a `build` section to your `xrmforge.config.json`:

```json
{
  "build": {
    "outDir": "./dist/contoso_/JS",
    "target": "es2020",
    "sourcemap": true,
    "minify": true,
    "entries": {
      "account_form": {
        "input": "./src/forms/account-form.ts",
        "namespace": "Contoso.AccountForm",
        "out": "Account/OnLoad.js"
      },
      "contact_form": {
        "input": "./src/forms/contact-form.ts",
        "namespace": "Contoso.ContactForm",
        "out": "Contact/OnLoad.js"
      },
      "shared_notifications": {
        "input": "./src/shared/notifications.ts",
        "namespace": "Contoso.Shared",
        "out": "Shared/Notifications.js"
      }
    }
  }
}
```

Then build:

```bash
xrmforge build            # Build all entries (parallel, IIFE bundles)
xrmforge build --watch    # Watch mode (~10ms incremental rebuilds)
xrmforge build --minify   # Override: minify output
xrmforge build --no-sourcemap  # Override: disable source maps
```

No `build.mjs`, no `esbuild.config.ts`, no direct esbuild dependency needed. The `@xrmforge/devkit` package handles everything.

### Option B: Manual build.mjs

If you prefer full control over esbuild, create `build.mjs` at your project root:

```javascript
import * as esbuild from "esbuild";

const webResources = [
  {
    entry: "src/forms/account-form.ts",
    globalName: "Contoso.AccountForm",
    out: "contoso_/JS/Account/OnLoad.js",
  },
];

for (const wr of webResources) {
  await esbuild.build({
    entryPoints: [wr.entry],
    bundle: true,
    format: "iife",
    globalName: wr.globalName,
    outfile: `dist/${wr.out}`,
    target: ["es2020"],
    minify: true,
    sourcemap: true,
  });
}
```

### package.json Scripts

```json
{
  "scripts": {
    "generate": "xrmforge generate",
    "typecheck": "tsc --noEmit",
    "build": "xrmforge build",
    "watch": "xrmforge build --watch"
  }
}
```

### Shared Libraries

When multiple form scripts use the same utility functions (e.g. notification helpers, GDPR logic, validation), extract them into a shared library:

1. Create `src/shared/notifications.ts` with your shared code.
2. Add it as an entry in `xrmforge.config.json` with its own `namespace` (e.g. `Contoso.Shared`).
3. In form scripts, access shared functions via the global namespace: `Contoso.Shared.showNotification(...)`.
4. In D365, upload the shared `.js` file as a Web Resource.
5. On each form that uses it, add the shared Web Resource as a **dependency** (Form Properties, then Event Handlers, then Dependencies). This ensures D365 loads the shared library before the form script.

This pattern avoids duplicating code across multiple bundles.

---

## 9. Deploying to D365

### Automated Deployment (recommended)

XrmForge includes a deploy script that pushes WebResources directly to D365 via the Dataverse Web API. No external tools needed (no spkl, no XrmToolBox, no manual upload).

**Setup:** Set environment variables for your target environment:

```bash
export DATAVERSE_URL=https://myorg.crm4.dynamics.com
export AZURE_TENANT_ID=your-tenant-id
```

The deploy script uses `@azure/identity` (MSAL) for authentication. On first run, it opens a browser for interactive sign-in. Tokens are cached and renewed automatically, no manual copy-paste needed. For CI/CD, set `AZURE_CLIENT_SECRET` to use Client Credentials instead.

**Deploy commands:**

```bash
npm run deploy          # Build + deploy changed WebResources
npm run deploy:dry      # Build + show what would be deployed (no changes)
npm run deploy:force    # Build + deploy ALL WebResources (ignore hashes)
npm run deploy:maps     # Build + deploy with source maps for debugging
```

The deploy script is **incremental**: it tracks SHA-256 hashes of deployed files and only uploads WebResources that actually changed. A full deploy of 7 WebResources takes about 3 seconds.

**How it works:**

1. Reads built `.js` files from `dist/`
2. Compares SHA-256 hashes against `.deploy-hashes.json` (local state)
3. Base64-encodes changed files
4. Creates or updates WebResources via `POST`/`PATCH` to `webresourceset`
5. Publishes all changed resources via `PublishXml`

### Manual Upload (alternative)

If you prefer manual deployment: in your D365 solution, go to Web Resources, upload the `.js` files from `dist/`, and publish.

**Naming convention:** `publisherprefix_/JS/Entity/Handler.js`, for example `contoso_/JS/Account/OnLoad.js`.

### Register a form event handler

1. Open the form in the form designer.
2. Go to **Form Properties**, then **Event Handlers**.
3. Add a handler. Enter the function name as `globalName.exportedFunction`, for example: `Contoso.Account.onLoad`.
4. Add any shared libraries as **Dependencies** so they load first.

---

## 10. Debugging

### Source Maps

Build with source maps enabled (this is the default). Source maps make debugging in browser DevTools straightforward.

### Browser DevTools

1. Open the form in D365.
2. Press F12 to open DevTools.
3. Press Ctrl+P (Cmd+P on Mac) and search for your `.ts` file name.
4. Set breakpoints in the original TypeScript source.

### Fiddler or Charles Proxy

For a rapid development loop without re-uploading Web Resources:

1. Set up a proxy rule that redirects the Web Resource URL to a local file on your machine.
2. Run `npm run watch` so esbuild rebuilds on every save.
3. Refresh the D365 form. The browser loads your local file via the proxy.

This gives you near-instant feedback: save a file, refresh the form, see your changes.

### Common DevTools Tips

- Use the **Console** tab to see `console.log` output from your form scripts.
- Use the **Network** tab to inspect Web API calls made by `Xrm.WebApi`.
- The `Xrm` object is available in the console. You can test calls interactively: `Xrm.Page.getAttribute("name").getValue()`.
  (Note: Xrm.Page is deprecated since D365 v9.0 but still works in the browser console for debugging.)

---

## 11. Common Patterns

### Lookup Values

Parse lookup fields from Web API responses into `Xrm.LookupValue` objects:

```typescript
import { parseLookup } from '@xrmforge/helpers';
import { AccountNavigationProperties as AccountNav } from '../../generated/entities/account.js';
import { AccountAccountFormFieldsEnum as Fields } from '../../generated/forms/account.js';

// Retrieve an account via Web API
const result = await Xrm.WebApi.retrieveRecord("account", accountId, "?$select=_primarycontactid_value");

// Parse the lookup
const contact = parseLookup(result, AccountNav.PrimaryContact);
if (contact) {
  formContext.getAttribute(Fields.PrimaryContact).setValue([{
    id: contact.id,
    name: contact.name,
    entityType: contact.entityType,
  }]);
}
```

### Form Notifications

Use the `FormNotificationLevel` constant instead of raw strings:

```typescript
import { FormNotificationLevel } from '@xrmforge/helpers';

formContext.ui.setFormNotification(
  "Record saved successfully.",
  FormNotificationLevel.Info,
  "save-notification",
);

// Clear notification after 5 seconds
setTimeout(() => {
  formContext.ui.clearFormNotification("save-notification");
}, 5000);
```

### Tab Display State

```typescript
import { DisplayState } from '@xrmforge/helpers';

const summaryTab = formContext.ui.tabs.get("SUMMARY_TAB");
if (summaryTab.getDisplayState() === DisplayState.Collapsed) {
  summaryTab.setDisplayState(DisplayState.Expanded);
}
```

### Progress Indicator

Wrap async operations with a progress spinner. Errors are not displayed here; they propagate to the handler wrapper (`wrapHandler`/`wrapCommand`), which owns the single error UI:

```typescript
import { withProgress } from '@xrmforge/helpers';
import { WinQuote } from '../generated/actions/quote';

await withProgress("Processing quote...", () =>
  WinQuote.execute(quoteId),
);
// Spinner closes automatically. On error it re-throws to the handler wrapper, which shows the notification.
```

### Required Level

```typescript
import { RequiredLevel } from '@xrmforge/helpers';

// Make email required when "Preferred Contact Method" is Email
formContext
  .getAttribute(Fields.Email)
  .setRequiredLevel(RequiredLevel.Required);
```

### Submit Mode

```typescript
import { SubmitMode } from '@xrmforge/helpers';

// Always submit this field, even if unchanged
formContext
  .getAttribute(Fields.ModifiedReason)
  .setSubmitMode(SubmitMode.Always);
```

### Save Mode

```typescript
import { SaveMode } from '@xrmforge/helpers';

export function onSave(executionContext: Xrm.Events.SaveEventContext): void {
  const saveMode = executionContext.getEventArgs().getSaveMode();

  if (saveMode === SaveMode.SaveAndClose) {
    // Custom validation before save-and-close
  }
}
```

### Batch Execution (executeMultiple)

Use `.request()` to build request objects, then execute them in a single batch:

```typescript
import { executeMultiple } from '@xrmforge/helpers';
import { ApproveRecord } from '../generated/actions/global';
import { NotifyOwner } from '../generated/actions/global';

const requests = [
  ApproveRecord.request({ RecordId: recordId }),
  NotifyOwner.request({ RecordId: recordId, Message: "Approved" }),
];

// Execute both in a single round-trip
const responses = await executeMultiple(requests);
```

### Testing Form Scripts (NEW in v0.2.0)

`@xrmforge/testing` creates type-safe mock objects from your generated form interfaces. No more `as any`, no more manual `XrmMockGenerator.Attribute.createString("name", ...)` setup:

```typescript
import { describe, it, expect } from 'vitest';
import { createFormMock } from '@xrmforge/testing';

import type { AccountMainForm as AccountForm, AccountMainFormMockValues as MockValues } from '../../generated/forms/account.js';

describe('Account onLoad', () => {
  it('should lock MPK field when value is set', () => {
    const mock = createFormMock<AccountForm>({
      markant_ismpk: 1,  // compile error if wrong type
    } satisfies MockValues);

    // Simulate business logic
    if (mock.getValue('markant_ismpk') === 0 || mock.getValue('markant_ismpk') === 1) {
      mock.getControl('markant_ismpk').setDisabled(true);
    }

    expect(mock.getControl('markant_ismpk').getDisabled()).toBe(true);
  });

  it('should provide EventContext for onLoad handler', () => {
    const mock = createFormMock<AccountForm>(
      { name: 'Contoso' } satisfies MockValues,
      { entityName: 'account', entityId: 'abc-123' },
    );

    const ctx = mock.asEventContext();
    const fc = ctx.getFormContext() as AccountForm;
    expect(fc.getAttribute('name').getValue()).toBe('Contoso');
  });
});
```

Install: `npm install -D @xrmforge/testing`

---

## 12. Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@xrmforge/typegen` | Core engine: metadata reading, type generation, Web API helpers, Xrm constants, action runtime, MockValues types, incremental generation with metadata cache | v0.6.0 |
| `@xrmforge/testing` | Type-safe form mock builder: `createFormMock()`, `fireOnChange()`, MockAttribute, MockControl, MockUi | v0.2.0 |
| `@xrmforge/cli` | Command-line interface: `generate` (with `--cache`), `build` (with `--watch`) | v0.4.2 |
| `@xrmforge/webapi` | Type-safe Web API client: `retrieve<T>()`, `retrieveMultiple<T>()`, `create()`, `update()`, `remove()`, QueryBuilder | v0.1.0 |
| `@xrmforge/helpers` | Browser-safe runtime: `select()`, `parseLookup()`, `typedForm()`, Xrm constants, Action/Function executors | v0.1.0 |
| `@xrmforge/devkit` | Build orchestration: esbuild IIFE bundles for D365 WebResources, `xrmforge build`, watch mode | v0.4.0 |
| `@xrmforge/pipeline` | CI/CD templates for Azure DevOps and GitHub Actions | Planned |
| `@xrmforge/eslint-plugin` | D365-specific ESLint rules: no-xrm-page, no-magic-optionset, no-sync-webapi, require-error-handling, require-namespace | v0.2.0 |

---

## 13. For Framework Developers

If you want to contribute to XrmForge itself or build on its internals:

```bash
git clone https://github.com/juergenbeck/XrmForge.git
cd XrmForge
pnpm install
pnpm build
pnpm test       # 699 tests across 7 packages
pnpm typecheck  # TypeScript strict mode
pnpm lint       # ESLint v9
```

The project uses:

- **pnpm** (v9+) as the package manager
- **Turborepo** for monorepo build orchestration
- **Vitest** for testing
- **tsup** (esbuild-based) for building packages
- **Changesets** for versioning and changelog generation
- **TypeScript strict mode** across all packages
- **ESM only** (`"type": "module"`)

See [CONTRIBUTING.md](CONTRIBUTING.md) for commit conventions, PR checklist, and code quality standards.

---

## 14. Troubleshooting

**"Cannot find namespace 'Xrm'"**

Install the Xrm type definitions:

```bash
npm install --save-dev @types/xrm
```

And make sure your `tsconfig.json` includes `"types": ["xrm"]`.

**"Cannot find namespace 'XrmForge'"**

Check that your `tsconfig.json` `include` array covers the generated files:

```json
"include": [
  "src/**/*.ts",
  "generated/**/*.ts"
]
```

Also verify that the `--output` directory matches the path in `include`.

**VS Code shows errors but `tsc` passes (or vice versa)**

VS Code runs its own TypeScript server. Try:

1. Press Ctrl+Shift+P, then "TypeScript: Restart TS Server".
2. Check that the TypeScript version in the VS Code status bar matches your project (click the version number to switch).
3. Ensure there is no duplicate `tsconfig.json` confusing the TS Server.

**Authentication fails with "AADSTS..."**

- Verify the App Registration has the **Dynamics CRM / user_impersonation** permission.
- If using `client-credentials`, confirm admin consent was granted and the Service Principal has a Dataverse application user with appropriate security roles.
- Check that `--tenant-id` and `--client-id` match the values from the Azure Portal.
- For interactive auth, ensure the Redirect URI `http://localhost` is configured in the App Registration.

**esbuild "Could not resolve" error**

If esbuild cannot resolve an import:

- For generated Custom API action files (`*.ts` in `generated/actions/`), make sure `@xrmforge/helpers` is in your `dependencies` (not just `devDependencies`), because the generated action files import `createBoundAction` etc. from it at runtime.
- Since v0.8.0, all generated files are `.ts` modules. Type-only imports (`import type { ... }`) are erased at runtime and do not affect the bundle.

**Generation succeeds but files are empty or incomplete**

- Check that the authenticated user has read access to entity metadata. A limited security role may hide some entities or attributes.
- Use `--verbose` for detailed logging that shows each metadata request and response.

---

## 15. Roadmap

### Shipped

- **`@xrmforge/testing`** (v0.2.0) -- Type-safe form mock builder with compile-time field validation.
- **`@xrmforge/webapi`** (v0.1.0) -- Type-safe Web API client: `retrieve<T>()`, `retrieveMultiple<T>()`, `create()`, `update()`, `remove()`, QueryBuilder with pagination.
- **`@xrmforge/helpers`** (v0.1.0) -- Browser-safe runtime: select(), parseLookup(), typedForm(), Xrm constants, Action/Function executors.
- **`@xrmforge/devkit`** (v0.4.0) -- Build orchestration: `xrmforge build` with IIFE bundles, watch mode, declarative config.
- **`@xrmforge/eslint-plugin`** (v0.2.0) -- D365-specific ESLint rules: no-xrm-page, no-magic-optionset, no-sync-webapi, require-error-handling, require-namespace.
- **Custom API live generation** -- `--actions` flag queries Custom API metadata from Dataverse and generates typed executors. `--actions-filter` for prefix filtering.
- **Solution-based discovery** -- `--solutions Sales,Service` discovers entities from Dataverse solutions automatically.
- **Incremental generation** -- `--cache` flag enables metadata caching with delta detection via `RetrieveMetadataChanges`. 10x faster on subsequent runs.

### Planned

- **`xrmforge init`** -- Project scaffolding: tsconfig templates, build configuration, example projects.
- **`@xrmforge/pipeline`** -- Ready-to-use CI/CD pipeline templates for Azure DevOps (YAML) and GitHub Actions.
- **webpack support** -- Tier 2 bundler for teams with existing webpack investment.

---

## 16. License

[MIT](LICENSE)

Copyright (c) 2026 XrmForge Contributors.
