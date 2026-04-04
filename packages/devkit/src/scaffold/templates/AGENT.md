# XrmForge - AI Agent Instructions

This file helps AI coding assistants write optimal Dynamics 365 form scripts.

## Packages

- `@xrmforge/typegen` - Generates typed declarations from Dataverse metadata
- `@xrmforge/testing` - Type-safe form mocks: createFormMock(), fireOnChange()
- `@xrmforge/formhelpers` - typedForm() proxy for direct field access
- `@xrmforge/devkit` - esbuild IIFE bundles via xrmforge build
- `@xrmforge/eslint-plugin` - D365-specific ESLint rules

## Generated Types (typings/ directory)

Run `xrmforge generate` to create:
- `typings/forms/{entity}.d.ts` - Form interface + Fields/Tabs/Sections/Subgrids enums
- `typings/optionsets/{entity}.d.ts` - OptionSet const enums
- `typings/entities/{entity}.d.ts` - Entity interface + Fields enum
- `typings/entity-names.d.ts` - EntityNames const enum

## Rules: Always

1. **Fields Enum** for getAttribute/getControl (not raw strings):
   `form.getAttribute(Fields.AccountName)` not `form.getAttribute("name")`

2. **OptionSet Enum** for comparisons (not magic numbers):
   `status === StatusCode.Active` not `status === 0`

3. **Cast formContext** to generated form interface:
   `const form = ctx.getFormContext() as AccountMainForm;`

4. **EntityNames Enum** for Web API calls:
   `Xrm.WebApi.retrieveRecord(EntityNames.Account, id)`

5. **parseLookup()** from @xrmforge/typegen/helpers for lookup values
   IMPORTANT: Use `@xrmforge/typegen/helpers` (not `@xrmforge/typegen`) in browser code.
   The main entry point pulls in Node.js dependencies that break esbuild bundles.

6. **select()** from @xrmforge/typegen/helpers for $select queries

7. **createFormMock()** from @xrmforge/testing for tests

8. **Module exports** (not window/global assignments). esbuild globalName handles namespacing.

9. **Tabs/Sections/Subgrids Enums** for UI access

10. **Error handling** in all async event handlers (try/catch)

## Rules: Never

- Never `getAttribute("raw_string")` when Fields enum exists
- Never magic numbers for OptionSet values
- Never `Xrm.Page` (deprecated since D365 v9.0)
- Never synchronous XMLHttpRequest
- Never `eval()`
- Never `window.X = ...` (use module exports)

## Before/After Examples

### Field Access
```typescript
// BEFORE: formContext.getAttribute("name").getValue()
// AFTER:
import { AccountMainFormFieldsEnum as Fields } from '../typings/forms/account';
const form = ctx.getFormContext() as AccountMainForm;
form.getAttribute(Fields.AccountName).getValue();  // StringAttribute, typed
```

### OptionSet Comparison
```typescript
// BEFORE: if (status.getValue() === 595300002) { ... }
// AFTER:
import { StatusCode } from '../typings/optionsets/invoice';
if (status.getValue() === StatusCode.Gebucht) { ... }
```

### Testing
```typescript
import { createFormMock } from '@xrmforge/testing';
const mock = createFormMock<AccountMainForm, AccountMainFormMockValues>({
  name: 'Test', statuscode: 0
});
onLoad(mock.executionContext);
expect(mock.formContext.getControl('revenue').getVisible()).toBe(true);
```

## File Structure

```
src/forms/{entity}-form.ts       - Form scripts (one per entity)
src/shared/{name}.ts             - Shared utilities
typings/                         - Generated types (do not edit manually)
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
| `"?$select=name,revenue"` | `select(Fields.Name, Fields.Revenue)` (from typegen/helpers) |
| `value[0].id.replace("{","")...` | `parseLookup(form.getAttribute(Fields.X))` (from typegen/helpers) |
| `Xrm.Page.getAttribute(...)` | `formContext.getAttribute(...)` |
| `var formContext` (global) | `const form = ctx.getFormContext()` (parameter) |
| `function form_OnLoad(ctx)` | `export function onLoad(ctx: Xrm.Events.EventContext)` |
| `.then(success, error)` | `async/await with try/catch` |

### Creating OptionSet Enums from Legacy Magic Numbers

When you find magic numbers like `getValue() === 105710002` in legacy code:
1. Search the file for ALL numeric comparisons with getValue()
2. Create a const enum in typings/optionsets/ with descriptive names
3. Import and use the enum instead of the number

Example:
```typescript
// typings/optionsets/invoice.ts
export const enum InvoiceStatusCode {
  Neu = 1,
  Versendet = 105710000,
  Abgeschlossen = 105710001,
  Gebucht = 105710002,
}

// In the form script:
import { InvoiceStatusCode } from '../../typings/optionsets/invoice';
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
   For manual typings, use regular `enum` in `.ts` files (not `.d.ts`).

## Full Migration Guide

See: https://www.npmjs.com/package/@xrmforge/typegen (MIGRATION.md)
