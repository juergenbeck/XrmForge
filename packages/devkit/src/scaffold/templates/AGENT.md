# XrmForge - AI Agent Instructions

This file helps AI coding assistants write optimal Dynamics 365 form scripts.

## Packages

- `@xrmforge/typegen` - Generates typed declarations from Dataverse metadata
- `@xrmforge/helpers` - Browser-safe runtime: select(), parseLookup(), typedForm(), Xrm constants, Action executors
- `@xrmforge/testing` - Type-safe form mocks: createFormMock(), fireOnChange()
- `@xrmforge/devkit` - esbuild IIFE bundles via xrmforge build
- `@xrmforge/eslint-plugin` - D365-specific ESLint rules

## Generated Types (generated/ directory)

Run `xrmforge generate` to create:
- `generated/forms/{entity}.ts` - Form interface + Fields/Tabs/Sections/Subgrids enums
- `generated/optionsets/{entity}.ts` - OptionSet const enums
- `generated/entities/{entity}.ts` - Entity interface
- `generated/fields/{entity}.ts` - Entity Fields enum for type-safe $select queries
- `generated/entity-names.ts` - EntityNames const enum
- `generated/index.ts` - Barrel file with `export * from` re-exports

## Rules: MANDATORY (every violation is a bug)

1. **Fields Enum** for ALL getAttribute/getControl calls. Never raw strings.
   ```typescript
   import { AccountMainFormFieldsEnum as Fields } from '../generated/forms/account.js';
   form.getAttribute(Fields.Name)  // CORRECT
   form.getAttribute("name")       // BUG - raw string
   ```

2. **OptionSet Enum** for ALL value comparisons. Never magic numbers.
   ```typescript
   import { StatusCode } from '../generated/optionsets/invoice.js';
   if (status === StatusCode.Active) // CORRECT
   if (status === 0)                 // BUG - magic number
   ```

3. **FormContext Cast** to generated form interface in every onLoad:
   ```typescript
   import type { AccountMainForm } from '../generated/forms/account.js';
   const form = ctx.getFormContext() as AccountMainForm;
   ```

4. **EntityNames Enum** in ALL Xrm.WebApi calls:
   ```typescript
   import { EntityNames } from '../generated/entity-names.js';
   Xrm.WebApi.retrieveRecord(EntityNames.Account, id)
   ```

5. **parseLookup()** from @xrmforge/helpers for ALL lookup value access:
   ```typescript
   import { parseLookup } from '@xrmforge/helpers';
   const customer = parseLookup(form.getAttribute(Fields.CustomerId));
   ```

6. **select()** from @xrmforge/helpers for ALL $select queries:
   ```typescript
   import { select } from '@xrmforge/helpers';
   Xrm.WebApi.retrieveRecord(EntityNames.Account, id, select(Fields.Name, Fields.Revenue))
   ```

7. **wrapHandler()** around EVERY exported async event handler:
   ```typescript
   import { createLogger } from '../shared/logger';
   import { wrapHandler } from '../shared/error-handler';
   const logger = createLogger('Namespace.Entity');
   export const onLoad = wrapHandler('Namespace.Entity.onLoad', logger, async (ctx) => {
     // handler code
   });
   ```

8. **createFormMock()** from @xrmforge/testing for ALL form tests:
   ```typescript
   import { createFormMock, fireOnChange, setupXrmMock } from '@xrmforge/testing';
   ```

9. **Module exports** (not window/global assignments). esbuild globalName handles namespacing.

10. **Structured Logger** instead of console.* (except in logger.ts itself):
    ```typescript
    import { createLogger } from '../shared/logger';
    const logger = createLogger('Namespace.Entity');
    logger.info('Form loaded', { recordId });
    ```

## Rules: NEVER (every occurrence is a bug)

- Never `getAttribute("raw_string")` when Fields enum exists
- Never magic numbers for OptionSet values (use OptionSet enums)
- Never `Xrm.Page` (deprecated since D365 v9.0)
- Never synchronous XMLHttpRequest
- Never `eval()`
- Never `window.X = ...` (use module exports)
- Never `console.log/warn/error` in form scripts (use shared logger)
- Never export async handlers without wrapHandler()
- Never `Xrm.WebApi.retrieveRecord("account", ...)` with raw entity name (use EntityNames)
- Never `"?$select=name,revenue"` as raw string (use select() from @xrmforge/helpers)
- Never `.getValue()[0].id.replace(...)` for lookups (use parseLookup() from @xrmforge/helpers)

## Mandatory Shared Utilities

Every XrmForge project MUST have these in `src/shared/`:

### logger.ts
```typescript
export interface Logger { debug(msg: string, data?: unknown): void; info(...); warn(...); error(...); }
export function createLogger(namespace: string): Logger;
// Only file allowed to use console.*
```

### error-handler.ts
```typescript
export function wrapHandler<T>(name: string, logger: Logger, handler: T): T;
// Catches sync+async errors, shows form notification, never rethrows
```

### constants.ts
```typescript
export const NOTIFICATION_IDS = { ... } as const;
export const MESSAGES = { ... } as const;
```

## Before/After Examples

### Field Access
```typescript
// BEFORE: formContext.getAttribute("name").getValue()
// AFTER:
import { AccountMainFormFieldsEnum as Fields } from '../generated/forms/account.js';
import type { AccountMainForm } from '../generated/forms/account.js';
const form = ctx.getFormContext() as AccountMainForm;
form.getAttribute(Fields.AccountName).getValue();  // StringAttribute, typed
```

### OptionSet Comparison
```typescript
// BEFORE: if (status.getValue() === 595300002) { ... }
// AFTER:
import { StatusCode } from '../generated/optionsets/invoice.js';
if (status.getValue() === StatusCode.Gebucht) { ... }
```

### Testing
```typescript
import { createFormMock } from '@xrmforge/testing';
const mock = createFormMock<AccountMainForm>({
  name: 'Test', statuscode: 0
});
onLoad(mock.executionContext);
expect(mock.formContext.getControl('revenue').getVisible()).toBe(true);
```

## File Structure

```
src/forms/{entity}-form.ts       - Form scripts (one per entity)
src/shared/{name}.ts             - Shared utilities
generated/                       - Generated types (do not edit manually)
tests/forms/{entity}.test.ts     - Tests
xrmforge.config.json             - Build config
```

## Pattern Recognition: Legacy to XrmForge

When you see these patterns in legacy code, apply the XrmForge replacement:

| Legacy Pattern | XrmForge Replacement |
|---|---|
| `getAttribute("name")` | `getAttribute(Fields.Name)` |
| `getControl("name")` | `getControl(Fields.Name)` |
| `getValue() === 595300000` | `getValue() === OptionSets.StatusCode.Active` |
| `Xrm.WebApi.retrieveRecord("account", id)` | `Xrm.WebApi.retrieveRecord(EntityNames.Account, id)` |
| `"?$select=name,revenue"` | `select(Fields.Name, Fields.Revenue)` (from @xrmforge/helpers) |
| `value[0].id.replace("{","")...` | `parseLookup(form.getAttribute(Fields.X))` (from @xrmforge/helpers) |
| `Xrm.Page.getAttribute(...)` | `formContext.getAttribute(...)` |
| `var formContext` (global) | `const form = ctx.getFormContext()` (parameter) |
| `function form_OnLoad(ctx)` | `export function onLoad(ctx: Xrm.Events.EventContext)` |
| `.then(success, error)` | `async/await with try/catch` |

### Creating OptionSet Enums from Legacy Magic Numbers

When you find magic numbers like `getValue() === 105710002` in legacy code:
1. Search the file for ALL numeric comparisons with getValue()
2. Create a const enum in generated/optionsets/ with descriptive names
3. Import and use the enum instead of the number

Example:
```typescript
// generated/optionsets/invoice.ts
export const enum InvoiceStatusCode {
  Neu = 1,
  Versendet = 105710000,
  Abgeschlossen = 105710001,
  Gebucht = 105710002,
}

// In the form script:
import { InvoiceStatusCode } from '../../generated/optionsets/invoice.js';
if (status.getValue() === InvoiceStatusCode.Gebucht) { ... }
```

## Testing with Global Xrm Mock

Use `setupXrmMock()` from @xrmforge/testing to mock the global Xrm namespace:
```typescript
import { createFormMock, setupXrmMock, teardownXrmMock } from '@xrmforge/testing';

beforeEach(() => setupXrmMock());
afterEach(() => teardownXrmMock());

// Override specific WebApi methods:
setupXrmMock({
  webApiOverrides: {
    retrieveMultipleRecords: async () => ({ entities: [{ name: 'Test' }] }),
  },
});
```

## Build

```bash
npx xrmforge build               # IIFE bundles for D365
npx xrmforge build --watch        # Watch mode (~10ms rebuilds)
```

## @types/xrm Pitfalls (known issues)

When creating manual typings without `xrmforge generate`:

1. **Form Interface:** Do NOT use `interface extends Xrm.FormContext` (getAttribute overload conflicts).
   Use `Omit` pattern instead:
   ```typescript
   interface AccountMainForm extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'> {
     getAttribute(name: Fields.AccountName): Xrm.Attributes.StringAttribute;
     getAttribute(name: string): Xrm.Attributes.Attribute;
     // ...
   }
   ```

2. **AlertDialogResponse** does NOT exist in @types/xrm. Use `Xrm.Async.PromiseLike<void>`.

3. **ConfirmDialogResponse** does NOT exist. Use `Xrm.Navigation.ConfirmResult`.

4. **setNotification()** requires 2 arguments: (message, uniqueId).

5. **openFile()** requires `fileSize` property in FileDetails.

6. **const enum in .d.ts files** cannot be imported at runtime by test frameworks.
   Since v0.8.0, XrmForge generates `.ts` files, so this is no longer an issue.
   For manual typings, use regular `enum` in `.ts` files (not `.d.ts`).

## Full Migration Guide

See: https://www.npmjs.com/package/@xrmforge/typegen (MIGRATION.md)
