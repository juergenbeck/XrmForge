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

5. **Lookup helpers** from @xrmforge/helpers for ALL lookup value access:
   ```typescript
   import { formLookup, formLookupId, parseLookup } from '@xrmforge/helpers';
   // Form lookups (getAttribute on FormContext):
   const customer = formLookup(form.getAttribute(Fields.CustomerId));
   const customerId = formLookupId(form.getAttribute(Fields.CustomerId));
   // Web API response lookups (_fieldname_value + OData annotations):
   const parent = parseLookup(apiResponse, 'parentaccountid');
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
- Never `.getValue()[0].id.replace(...)` for lookups (use formLookup/formLookupId from @xrmforge/helpers)
- Never `import ... from '@xrmforge/typegen'` in browser code. @xrmforge/typegen is a Node.js CLI tool. Use `@xrmforge/helpers` for browser-safe runtime functions (select, parseLookup, formLookup, createUnboundAction, etc.)

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
onLoad(mock.asEventContext());
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

## Self-Check (MANDATORY before Tests)

After converting ALL scripts, run these checks. Fix every violation before proceeding to tests.
Document results in SESSION-GEDAECHTNIS.md (violation count per category).

### Pattern Compliance (all must be 0, or documented exception)

```bash
# 1. Raw field strings in getAttribute/getControl (must use Fields Enum)
grep -rn "getAttribute('" src/forms/ --include="*.ts" | grep -v "Fields\."
grep -rn "getControl('" src/forms/ --include="*.ts" | grep -v "Fields\."

# 2. Magic numbers in OptionSet comparisons (must use OptionSet Enum)
grep -rn "getValue() ===" src/ --include="*.ts" | grep -E "[0-9]{3,}"

# 3. Direct _value access instead of parseLookup (in Web API responses)
grep -rn "_value\b" src/ --include="*.ts" | grep -v "generated/" | grep -v "parseLookup" | grep -v "getValue"

# 4. Raw entity names in WebApi calls (must use EntityNames)
grep -rn "retrieveRecord\|retrieveMultipleRecords\|deleteRecord\|createRecord\|updateRecord" src/ --include="*.ts" | grep "'[a-z]" | grep -v "EntityNames"

# 5. Missing select() in retrieveRecord (no raw "$select=" strings)
grep -rn "retrieveRecord\|retrieveMultipleRecords" src/ --include="*.ts" | grep "\$select" | grep -v "select("

# 6. Missing FormContext Cast in onLoad (must have "as <Generated>Form")
grep -rn "getFormContext()" src/forms/ --include="*.ts" | grep -v " as "

# 7. Exported handlers without wrapHandler
grep -rn "^export const\|^export async function\|^export function" src/forms/ --include="*.ts" | grep -v "wrapHandler"

# 8. Entity-level FieldsEnums not used (generated/fields/ should be imported)
echo "Fields imports from generated/fields/:"
grep -rn "from.*generated/fields/" src/ --include="*.ts" | wc -l
```

### Code Quality (all must be 0)

```bash
# console.* outside logger.ts
grep -rn "console\." src/ --include="*.ts" | grep -v "logger.ts"

# Xrm.Page (deprecated since D365 v9.0)
grep -rn "Xrm\.Page" src/ --include="*.ts"

# var declarations
grep -rnE "^\s*var " src/ --include="*.ts"

# eval()
grep -rn "\beval(" src/ --include="*.ts"

# XMLHttpRequest
grep -rn "XMLHttpRequest" src/ --include="*.ts"

# as any without eslint-disable comment explaining why
grep -rn "as any" src/ --include="*.ts" | grep -v "eslint-disable"
```

### Documentation (all must pass)

```bash
# Files without JSDoc header (first line must be /**)
for f in src/forms/*.ts src/shared/*.ts; do
  head -1 "$f" | grep -q "^/\*\*" || echo "No header: $f"
done

# Exported functions without JSDoc
grep -rn -B1 "^export " src/ --include="*.ts" | grep -E "^[^*]*export" | grep -v "/\*\*"
```

### Test Completeness

```bash
# Every form script needs a test file
for f in src/forms/*.ts; do
  base=$(basename "$f" .ts)
  test -f "tests/forms/${base}.test.ts" || echo "No test: $f"
done

# Every test file must use setupXrmMock
for f in tests/**/*.test.ts; do
  grep -q "setupXrmMock" "$f" || echo "No setupXrmMock: $f"
done

# Every test file needs at least 2 test cases
for f in tests/**/*.test.ts; do
  count=$(grep -c "it(" "$f" 2>/dev/null || echo 0)
  [ "$count" -lt 2 ] && echo "Only $count tests: $f"
done
```

### Exceptions

Some checks have legitimate exceptions:
- **Raw field strings in helpers**: Generic helper functions that accept `fieldName: string` parameters cannot use Fields Enums. Document these.
- **System entities not in EntityNames**: Entities not in the Solution (e.g. `annotation`, `transactioncurrency`, `systemuser`) may use string literals. Document which ones.
- **as any for Grid.refresh()**: `@types/xrm` does not type `Grid.refresh()`. Requires eslint-disable with explanation.

## Full Migration Guide

See: https://www.npmjs.com/package/@xrmforge/typegen (MIGRATION.md)
