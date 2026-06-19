# @xrmforge/typegen

[![npm version](https://img.shields.io/npm/v/@xrmforge/typegen.svg)](https://www.npmjs.com/package/@xrmforge/typegen)
[![license](https://img.shields.io/npm/l/@xrmforge/typegen.svg)](https://github.com/juergenbeck/XrmForge/blob/main/LICENSE)

**The type-generation engine of XrmForge.** Reads Dynamics 365 / Dataverse metadata and generates TypeScript declarations that *extend* `@types/xrm` (never replace it), so your generated types coexist with PCF controls and the rest of the Microsoft ecosystem.

> Most users do not call this package directly -- they use [`@xrmforge/cli`](https://www.npmjs.com/package/@xrmforge/cli) (`xrmforge generate`), which wraps this engine. Install `@xrmforge/typegen` directly only when you want to embed generation in your own Node.js tooling. For the full framework docs, see the [XrmForge repository](https://github.com/juergenbeck/XrmForge#readme).

---

## What it generates

For each entity, typegen emits flat ES modules (`.ts` files) -- one file per concern, imported and processed by your bundler. No `declare namespace`, no ambient `.d.ts`.

```
generated/
  entities/account.ts      export interface Account { ... }       // typed Web API response objects
  fields/account.ts        export const enum AccountFields         // $select / $filter (already _value form)
                           export const enum AccountNavigationProperties  // parseLookup / $expand / @odata.bind
  optionsets/account.ts    export const enum IndustryCode ...       // every picklist/status/state field
  forms/account.ts         Union + maps + Fields enum + Form interface + FormTypeInfo + MockValues
  actions/quote.ts         export const WinQuote = createBoundAction(...)  // typed Custom API executors
  entity-names.ts          export const enum EntityNames
  index.ts                 barrel re-export
```

Each generated artifact is a compile-time contract:

- **Entity interfaces** -- all attributes correctly typed (string, number, boolean, Lookup, OptionSet, DateTime).
- **Form interfaces** -- per-form `getAttribute()` / `getControl()` overloads. Only fields actually on the form are valid; no string fallback, no `any`.
- **OptionSet enums** -- `const enum`, inlined by TypeScript (zero runtime overhead).
- **Fields / NavigationProperties enums** -- type-safe `$select` and lookup navigation.
- **Action / Function executors** -- generated from Custom API metadata, with typed parameters and responses.
- **Dual-language JSDoc** -- `/** Account Name | Firmenname */` when `--secondary-language` is set.

---

## Usage via the CLI (recommended)

```bash
npm install --save-dev @xrmforge/cli @types/xrm
npx xrmforge generate --url https://myorg.crm4.dynamics.com --auth interactive \
  --tenant-id YOUR_TENANT_ID --client-id 51f81489-12ee-4a9e-aaae-a2591f45987d \
  --entities account,contact --output ./generated
```

See [`@xrmforge/cli`](https://www.npmjs.com/package/@xrmforge/cli) for every flag, authentication method, incremental caching (`--cache`), and drift detection (`--check`).

---

## Programmatic API

Install directly when embedding generation in your own tooling:

```bash
npm install @xrmforge/typegen @types/xrm
```

The high-level entry point is the orchestrator, which runs the full pipeline (authenticate, read metadata, generate, write). It takes a credential and a config:

```typescript
import { TypeGenerationOrchestrator, createCredential } from '@xrmforge/typegen';

// 1. Build a credential from an auth config
//    (method: 'interactive' | 'client-credentials' | 'device-code' | 'token')
const credential = createCredential({
  method: 'interactive',
  tenantId: 'YOUR_TENANT_ID',
  clientId: '51f81489-12ee-4a9e-aaae-a2591f45987d',
});

// 2. Run the pipeline
const orchestrator = new TypeGenerationOrchestrator(credential, {
  environmentUrl: 'https://myorg.crm4.dynamics.com',
  entities: ['account', 'contact'],
  outputDir: './generated',
  labelConfig: { primaryLanguage: 1033, secondaryLanguage: 1031 },
});

const result = await orchestrator.generate();
console.log(`Generated ${result.totalFiles} files`);
```

For finer control, the building blocks are exported individually:

| Area | Exports |
|------|---------|
| Orchestration | `TypeGenerationOrchestrator`, types `GenerateConfig`, `GenerationResult`, `CheckResult`, `CheckFinding`, `CacheStats` |
| Authentication | `createCredential`, types `AuthConfig`, `ClientCredentialsAuth`, `InteractiveAuth`, `DeviceCodeAuth` |
| HTTP | `DataverseHttpClient` (ReadOnly-default, retry, rate-limit), type `HttpClientOptions` |
| Metadata | `MetadataClient`, `MetadataCache`, `ChangeDetector`, `parseForm`, plus rich metadata types (`EntityMetadata`, `AttributeMetadata`, `OptionSetMetadata`, `SystemFormMetadata`, ...) |
| Code generators | `generateEntityInterface`, `generateFormInterface`, `generateOptionSetEnum`, `generateEntityFieldsEnum`, `generateActionModule`, `generateEntityNamesEnum`, ... |
| Type mapping | `getEntityPropertyType`, `getFormAttributeType`, `toSafeIdentifier`, `toPascalCase`, `isLookupType`, ... |
| Logging | `Logger`, `ConsoleLogSink`, `JsonLogSink`, `SilentLogSink`, `LogLevel`, `configureLogging` |
| Errors | `XrmForgeError`, `AuthenticationError`, `ApiRequestError`, `MetadataError`, `GenerationError`, `ConfigError`, `isXrmForgeError`, `isRateLimitError` |

> **Node.js only.** This package pulls in `@azure/identity` and Node APIs. Do **not** import it in browser/form-script code -- use [`@xrmforge/helpers`](https://www.npmjs.com/package/@xrmforge/helpers) for the browser runtime. The `@xrmforge/eslint-plugin` rule `no-typegen-import` enforces this.

---

## Peer dependency

`@types/xrm` (>= 9.0.0) -- the generated types build on top of it.

## Documentation

Full guide and generated-type patterns: [XrmForge on GitHub](https://github.com/juergenbeck/XrmForge#readme).

## License

[MIT](https://github.com/juergenbeck/XrmForge/blob/main/LICENSE) (c) XrmForge Contributors.
