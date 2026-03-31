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
- [8. Building for D365 (esbuild)](#8-building-for-d365-esbuild)
  - [Why IIFE?](#why-iife)
  - [build.mjs](#buildmjs)
  - [package.json Scripts](#packagejson-scripts)
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
const name = formContext.getAttribute("name");       // Xrm.Attributes.Attribute (generic)
name.setValue(123);                                   // No compile error, runtime crash!
formContext.getAttribute("naem");                     // Typo passes silently

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
const form = typedForm<AccountFields, AccountAttrMap>(formContext);
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
- **Web API Helpers** -- `select()`, `parseLookup()`, `parseFormattedValue()`, `withProgress()`, and more.
- **Xrm Constants** -- `DisplayState`, `FormNotificationLevel`, `RequiredLevel`, `SubmitMode`, `SaveMode`, `ClientType`, `OperationType`, and others as `const enum`. No more raw strings.
- **Dual-Language Labels** -- JSDoc comments show both languages: `/** Account Name | Firmenname */`. Autocomplete in VS Code shows both.
- **esbuild Build Pipeline** -- IIFE bundles for D365, ready to upload as Web Resources. Sub-second builds.

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

XrmForge supports multiple authentication methods. You only need one:

- **Interactive Browser** (recommended for getting started): Opens a browser, you sign in. Requires an Azure App Registration with redirect URI.
- **Device Code**: Displays a code you enter at microsoft.com/devicelogin. Works on headless terminals. Requires an App Registration.
- **Client Credentials**: Service Principal with client secret. For CI/CD pipelines. Requires an App Registration with admin consent.
- **Token**: Pass a pre-acquired Bearer token. No App Registration needed if you get the token externally.

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

Replace `YOUR_TENANT_ID` and `YOUR_APP_ID` with values from your Azure App Registration (see [Azure App Registration](#azure-app-registration) for how to get them).

```bash
npx xrmforge generate \
  --url https://myorg.crm4.dynamics.com \
  --auth interactive \
  --tenant-id YOUR_TENANT_ID \
  --client-id YOUR_APP_ID \
  --entities account,contact,opportunity \
  --output ./generated \
  --secondary-language 1031
```

This opens a browser window for authentication, reads entity metadata, and writes `.d.ts` files into `./generated/`.

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
    "generated/**/*.d.ts",
    "generated/**/*.ts"
  ]
}
```

**Step 5: Write your first form script.**

Create `src/forms/account-form.ts`:

```typescript
type AccountForm = XrmForge.Forms.Account.AccountAccountForm;
import Fields = XrmForge.Forms.Account.AccountAccountFormFieldsEnum;

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
    actions/            # Custom API executors (.d.ts + .ts)
    index.d.ts          # Barrel file with /// references
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
| `--url <url>` | Dataverse environment URL (e.g. `https://myorg.crm4.dynamics.com`) | Required |
| `--auth <method>` | Authentication method: `interactive`, `client-credentials`, `device-code`, `token` | Required |
| `--tenant-id <id>` | Azure AD tenant ID | Required for most auth methods |
| `--client-id <id>` | Azure AD application (client) ID | Required for most auth methods |
| `--client-secret <secret>` | Client secret (for `client-credentials` only) | -- |
| `--token <token>` | Pre-acquired Bearer token (for `token` auth). Prefer `XRMFORGE_TOKEN` env var | -- |
| `--entities <list>` | Comma-separated entity logical names (e.g. `account,contact,opportunity`) | -- |
| `--solution <name>` | Solution unique name (discovers all entities in the solution) | -- |
| `--output <dir>` | Output directory for generated files | `./typings` |
| `--label-language <code>` | Primary label language LCID | `1033` (English) |
| `--secondary-language <code>` | Secondary label language LCID (for dual-language JSDoc) | -- |
| `--no-forms` | Skip form interface generation | Forms enabled |
| `--no-optionsets` | Skip OptionSet enum generation | OptionSets enabled |
| `-v, --verbose` | Enable verbose/debug logging | Off |

Either `--entities` or `--solution` must be specified. When using `--solution`, XrmForge discovers all entities that are part of that solution.

### Authentication

Three methods are supported, all powered by `@azure/identity` (MSAL). A fourth method (`token`) allows passing a pre-acquired Bearer token.

**Interactive (developer laptop, opens browser)**

Best for local development. Opens a browser window for you to sign in.

```bash
npx xrmforge generate \
  --url https://myorg.crm4.dynamics.com \
  --auth interactive \
  --tenant-id YOUR_TENANT_ID \
  --client-id YOUR_APP_ID \
  --entities account,contact \
  --output ./generated
```

**Client Credentials (CI/CD, Service Principal)**

Best for automated pipelines. Uses a client secret, no user interaction.

```bash
npx xrmforge generate \
  --url https://myorg.crm4.dynamics.com \
  --auth client-credentials \
  --tenant-id YOUR_TENANT_ID \
  --client-id YOUR_APP_ID \
  --client-secret YOUR_SECRET \
  --entities account,contact \
  --output ./generated
```

In CI/CD, pass the secret via environment variable rather than command-line argument.

**Device Code (headless terminal, SSH sessions)**

Best for remote servers without a browser. Displays a code you enter at https://microsoft.com/devicelogin.

```bash
npx xrmforge generate \
  --url https://myorg.crm4.dynamics.com \
  --auth device-code \
  --tenant-id YOUR_TENANT_ID \
  --client-id YOUR_APP_ID \
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

### Azure App Registration

If you do not have an App Registration yet, follow these steps in the Azure Portal:

1. Go to [https://portal.azure.com](https://portal.azure.com) and sign in.
2. Navigate to **Azure Active Directory** (or **Microsoft Entra ID**), then **App registrations**, then **New registration**.
3. Fill in:
   - **Name:** `XrmForge Type Generator` (or any name you prefer)
   - **Supported account types:** Single tenant (your organization only)
   - **Redirect URI:** Select "Web" and enter `http://localhost` (needed for interactive auth)
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
    "generated/**/*.d.ts",
    "generated/**/*.ts"
  ]
}
```

Key points:

- `"types": ["xrm"]` loads the global `Xrm` namespace from `@types/xrm`.
- `"strict": true` enables all strict checks. This is where XrmForge shines.
- The `include` array must cover both your source code and the generated declarations.

### Writing a Form Script

A complete, realistic form script:

```typescript
// src/forms/account-form.ts

// Type alias for the form interface (generated per form)
type AccountForm = XrmForge.Forms.Account.AccountAccountForm;

// Fields enum: autocomplete shows all fields on this form, with dual-language labels
import Fields = XrmForge.Forms.Account.AccountAccountFormFieldsEnum;

// OptionSet enum (generated from picklist metadata)
import IndustryCode = XrmForge.OptionSets.IndustryCode;

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
import { select, parseLookup, parseFormattedValue } from '@xrmforge/typegen';
import AccountFields = XrmForge.Entities.AccountFields;
import AccountNav = XrmForge.Entities.AccountNavigationProperties;

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
// Import the generated executor (both .d.ts and .ts are generated)
import { NormalizePhone } from '../generated/actions/global';

async function normalizePhoneNumber(
  formContext: XrmForge.Forms.Contact.ContactContactForm,
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
import { withProgress } from '@xrmforge/typegen';

async function winQuote(quoteId: string): Promise<void> {
  // withProgress shows a spinner, handles errors with a dialog
  await withProgress("Processing quote...", () =>
    WinQuote.execute(quoteId),
  );
}
```

---

## 8. Building for D365 (esbuild)

### Why IIFE?

Dynamics 365 loads Web Resources via `<script>` tags. Functions must be globally accessible so the form event handler system can call them by name (e.g. `Contoso.AccountForm.onLoad`). The IIFE (Immediately Invoked Function Expression) format wraps your module code and exposes it under a global namespace.

### build.mjs

Create `build.mjs` at your project root. This is a complete, copy-paste-ready build script:

```javascript
import * as esbuild from "esbuild";

// Each entry produces one Web Resource .js file.
// globalName determines the D365 function namespace.
const webResources = [
  {
    entry: "src/forms/account-form.ts",
    globalName: "Contoso.AccountForm",
    out: "contoso_/JS/Account/OnLoad.js",
  },
  {
    entry: "src/forms/contact-form.ts",
    globalName: "Contoso.ContactForm",
    out: "contoso_/JS/Contact/OnLoad.js",
  },
  {
    entry: "src/shared/notifications.ts",
    globalName: "Contoso.Shared",
    out: "contoso_/JS/Shared/Notifications.js",
  },
];

const isDev = process.argv.includes("--dev");
const isWatch = process.argv.includes("--watch");

for (const wr of webResources) {
  const options = {
    entryPoints: [wr.entry],
    bundle: true,
    format: "iife",
    globalName: wr.globalName,
    outfile: `dist/${wr.out}`,
    target: ["es2020"],
    minify: !isDev,
    sourcemap: isDev ? "inline" : true,
  };

  if (isWatch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log(`Watching: ${wr.entry}`);
  } else {
    await esbuild.build(options);
    console.log(`Built: dist/${wr.out}`);
  }
}

if (!isWatch) {
  console.log("\nBuild complete.");
}
```

Run it:

```bash
node build.mjs           # Production build (minified, external source maps)
node build.mjs --dev     # Development build (not minified, inline source maps)
node build.mjs --watch   # Watch mode (rebuilds on file changes)
```

### package.json Scripts

Add these scripts to your `package.json` for convenience:

```json
{
  "scripts": {
    "generate": "xrmforge generate",
    "typecheck": "tsc --noEmit",
    "build": "node build.mjs",
    "build:dev": "node build.mjs --dev",
    "watch": "node build.mjs --watch"
  }
}
```

Then use:

```bash
npm run generate    # Regenerate types from Dataverse
npm run typecheck   # Check types without producing output
npm run build       # Production build
npm run build:dev   # Development build with inline source maps
npm run watch       # Watch mode for rapid development
```

### Shared Libraries

When multiple form scripts use the same utility functions (e.g. notification helpers, GDPR logic, validation), extract them into a shared library:

1. Create `src/shared/notifications.ts` with your shared code.
2. Add it to `build.mjs` with its own `globalName` (e.g. `Contoso.Shared`).
3. In form scripts, access shared functions via the global namespace: `Contoso.Shared.showNotification(...)`.
4. In D365, upload the shared `.js` file as a Web Resource.
5. On each form that uses it, add the shared Web Resource as a **dependency** (Form Properties, then Event Handlers, then Dependencies). This ensures D365 loads the shared library before the form script.

This pattern avoids duplicating code across multiple bundles.

---

## 9. Deploying to D365

After building, the `dist/` directory contains `.js` files ready for upload.

**Naming convention for Web Resources:**

Use the format `publisherprefix_/JS/Entity/Handler.js`. For example:

- `contoso_/JS/Account/OnLoad.js`
- `contoso_/JS/Contact/OnLoad.js`
- `contoso_/JS/Shared/Notifications.js`

**Upload steps:**

1. In your D365 solution, go to **Web Resources** and add a new JavaScript resource.
2. Upload the `.js` file from `dist/`.
3. Publish the Web Resource.

**Register a form event handler:**

1. Open the form in the form designer.
2. Go to **Form Properties**, then **Event Handlers**.
3. Add a handler. Enter the function name exactly as defined by `globalName` plus the exported function name, for example: `Contoso.AccountForm.onLoad`.
4. Add any shared libraries as **Dependencies** so they load first.

**Source maps for debugging (optional):**

Upload the `.js.map` files alongside the `.js` files. Browser DevTools will pick them up automatically, letting you debug in original TypeScript.

---

## 10. Debugging

### Source Maps

Build with source maps enabled (this is the default in `build.mjs`). For development, use inline source maps (`--dev` flag) so you only upload one file.

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

---

## 11. Common Patterns

### Lookup Values

Parse lookup fields from Web API responses into `Xrm.LookupValue` objects:

```typescript
import { parseLookup } from '@xrmforge/typegen';
import AccountNav = XrmForge.Entities.AccountNavigationProperties;
import Fields = XrmForge.Forms.Account.AccountAccountFormFieldsEnum;

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
import { FormNotificationLevel } from '@xrmforge/typegen';

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
import { DisplayState } from '@xrmforge/typegen';

const summaryTab = formContext.ui.tabs.get("SUMMARY_TAB");
if (summaryTab.getDisplayState() === DisplayState.Collapsed) {
  summaryTab.setDisplayState(DisplayState.Expanded);
}
```

### Progress Indicator

Wrap async operations with a progress spinner and automatic error dialog:

```typescript
import { withProgress } from '@xrmforge/typegen';
import { WinQuote } from '../generated/actions/quote';

await withProgress("Processing quote...", () =>
  WinQuote.execute(quoteId),
);
// Spinner closes automatically. On error, an error dialog is shown.
```

### Required Level

```typescript
import { RequiredLevel } from '@xrmforge/typegen';

// Make email required when "Preferred Contact Method" is Email
formContext
  .getAttribute(Fields.Email)
  .setRequiredLevel(RequiredLevel.Required);
```

### Submit Mode

```typescript
import { SubmitMode } from '@xrmforge/typegen';

// Always submit this field, even if unchanged
formContext
  .getAttribute(Fields.ModifiedReason)
  .setSubmitMode(SubmitMode.Always);
```

### Save Mode

```typescript
import { SaveMode } from '@xrmforge/typegen';

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
import { executeMultiple } from '@xrmforge/typegen';
import { ApproveRecord } from '../generated/actions/global';
import { NotifyOwner } from '../generated/actions/global';

const requests = [
  ApproveRecord.request({ RecordId: recordId }),
  NotifyOwner.request({ RecordId: recordId, Message: "Approved" }),
];

// Execute both in a single round-trip
const responses = await executeMultiple(requests);
```

---

## 12. Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@xrmforge/typegen` | Core engine: metadata reading, type generation, Web API helpers, Xrm constants, action runtime | v0.1.0 |
| `@xrmforge/cli` | Command-line interface for generating types | v0.1.0 |
| `@xrmforge/webapi` | Type-safe Web API client (retrieve, create, update, delete with generated entity types) | In Development |
| `@xrmforge/formhelpers` | Form scripting utilities (tab management, field visibility, notifications) | Planned |
| `@xrmforge/devkit` | Project scaffolding and build configuration templates | Planned |
| `@xrmforge/pipeline` | CI/CD templates for Azure DevOps and GitHub Actions | Planned |
| `@xrmforge/eslint-plugin` | D365-specific ESLint rules (e.g. no raw `getAttribute` strings, no magic numbers for OptionSets) | Planned |

---

## 13. For Framework Developers

If you want to contribute to XrmForge itself or build on its internals:

```bash
git clone https://github.com/juergenbeck/XrmForge.git
cd XrmForge
pnpm install
pnpm build
pnpm test       # 400 tests across 2 packages
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
  "generated/**/*.d.ts",
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

- For `@xrmforge/typegen` runtime helpers (like `createUnboundAction`), make sure `@xrmforge/typegen` is in your `dependencies` (not just `devDependencies`), because the generated action `.ts` files import from it at runtime.
- For generated `.d.ts` files (declaration-only), no runtime import is needed. They are resolved by TypeScript during type-checking but do not exist at runtime.

**Generation succeeds but files are empty or incomplete**

- Check that the authenticated user has read access to entity metadata. A limited security role may hide some entities or attributes.
- Use `--verbose` for detailed logging that shows each metadata request and response.

---

## 15. Roadmap

Planned additions for upcoming releases:

- **`@xrmforge/webapi`** -- A type-safe Web API client that uses generated entity interfaces for `retrieve`, `create`, `update`, and `delete` operations. No more untyped `Record<string, unknown>` responses.
- **`@xrmforge/formhelpers`** -- Utility functions for common form scripting patterns: tab/section visibility, field locking, lookup filtering, ribbon control.
- **`@xrmforge/devkit`** -- Project scaffolding (`xrmforge init`), tsconfig templates, build configuration, and example projects.
- **`@xrmforge/pipeline`** -- Ready-to-use CI/CD pipeline templates for Azure DevOps (YAML) and GitHub Actions. Automated type generation, type-checking, building, and Web Resource deployment.
- **`@xrmforge/eslint-plugin`** -- ESLint rules specific to D365 development. Warns about raw `getAttribute("string")` calls, magic OptionSet numbers, missing error handling in async form handlers, and more.
- **Solution-based discovery** -- Generate types for all entities in a Dataverse solution automatically.
- **Incremental generation** -- Only re-generate types for entities whose metadata has changed since the last run.

---

## 16. License

[MIT](LICENSE)

Copyright (c) 2026 XrmForge Contributors.
