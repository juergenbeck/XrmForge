# XrmForge - AI Agent Instructions

This file helps AI coding assistants (Claude, ChatGPT, Copilot, Cursor, etc.)
write optimal Dynamics 365 form scripts using the XrmForge framework.

## What is XrmForge?

XrmForge generates TypeScript declarations from Dynamics 365 Dataverse metadata.
It turns runtime errors into compile-time errors. Every field name, OptionSet value,
tab name, and subgrid name becomes a typed constant with IDE autocomplete.

## Available Packages

```
@xrmforge/cli          - CLI: generate types, build WebResources, scaffold projects
@xrmforge/typegen      - Core: type generation engine, Web API helpers, Xrm constants
@xrmforge/testing      - Test: createFormMock(), fireOnChange(), type-safe mocks
@xrmforge/formhelpers  - Runtime: typedForm() proxy for direct field access
@xrmforge/devkit       - Build: esbuild IIFE bundles, project scaffolding
@xrmforge/eslint-plugin - Lint: D365-specific ESLint rules
```

## Generated Types (in typings/ directory)

After running `xrmforge generate`, these files exist:

- `typings/entities/{entity}.d.ts` - Entity interface + Fields enum
- `typings/forms/{entity}.d.ts` - Form interface + Fields enum + Tabs/Sections/Subgrids enums
- `typings/optionsets/{entity}.d.ts` - OptionSet const enums with labels
- `typings/entity-names.d.ts` - EntityNames const enum

## RULES: Always Do This

### 1. Use Fields Enum for getAttribute/getControl

```typescript
// WRONG - raw string, no compile-time check, typos pass silently
const name = formContext.getAttribute("name");

// CORRECT - Fields enum, compile error on typo, autocomplete
import { AccountMainFormFieldsEnum as Fields } from '../../typings/forms/account';
const name = form.getAttribute(Fields.AccountName);
```

### 2. Use OptionSet Enums for Comparisons (No Magic Numbers)

```typescript
// WRONG - magic number, nobody knows what 595300002 means
if (status.getValue() === 595300002) { ... }

// CORRECT - const enum, self-documenting, zero runtime overhead
import { StatusCode } from '../../typings/optionsets/account';
if (status.getValue() === StatusCode.Gebucht) { ... }
```

### 3. Cast formContext to the Generated Form Interface

```typescript
// WRONG - generic FormContext, no field validation
const formContext = executionContext.getFormContext();
formContext.getAttribute("nonexistent_field"); // no error!

// CORRECT - typed form, only real fields compile
const form = executionContext.getFormContext() as AccountMainForm;
form.getAttribute("nonexistent_field"); // COMPILE ERROR
```

### 4. Use EntityNames Enum for Web API Calls

```typescript
// WRONG
Xrm.WebApi.retrieveRecord("account", id);

// CORRECT
import { EntityNames } from '../../typings/entity-names';
Xrm.WebApi.retrieveRecord(EntityNames.Account, id);
```

### 5. Use parseLookup for Lookup Values

```typescript
// WRONG - manual null check, GUID cleanup
const val = formContext.getAttribute("customerid").getValue();
if (val && val.length > 0) {
  const id = val[0].id.replace("{","").replace("}","");
}

// CORRECT
import { parseLookup } from '@xrmforge/typegen/helpers';
const customer = parseLookup(form.getAttribute(Fields.CustomerId));
if (customer) { console.log(customer.id); }
```

### 6. Use select() for Web API $select

```typescript
// WRONG - raw strings in $select
"?$select=name,revenue,statuscode"

// CORRECT - typed, refactor-safe
import { select } from '@xrmforge/typegen/helpers';
import { AccountFields } from '../../typings/entities/account';
`?$select=${select(AccountFields.Name, AccountFields.Revenue, AccountFields.StatusCode)}`
```

### 7. Write Tests with @xrmforge/testing

```typescript
import { describe, it, expect } from 'vitest';
import { createFormMock, fireOnChange } from '@xrmforge/testing';
import type { AccountMainForm, AccountMainFormMockValues } from '../../typings/forms/account';
import { onLoad } from '../src/forms/account-form';

describe('Account onLoad', () => {
  it('should show revenue for active accounts', () => {
    const mock = createFormMock<AccountMainForm, AccountMainFormMockValues>({
      name: 'Contoso Ltd',
      statuscode: 0,  // Active
      revenue: 1000000,
    });

    onLoad(mock.executionContext);

    expect(mock.formContext.getControl('revenue').getVisible()).toBe(true);
  });
});
```

### 8. Export Functions (Not Namespace Objects)

```typescript
// WRONG - manual namespace pattern
window.Contoso = window.Contoso || {};
window.Contoso.Account = { onLoad: function() { ... } };

// CORRECT - module exports, esbuild creates the namespace via globalName
export function onLoad(executionContext: Xrm.Events.EventContext): void {
  // ...
}
export function onSave(executionContext: Xrm.Events.EventContext): void {
  // ...
}
```

The build config in xrmforge.config.json defines the globalName (e.g. "Contoso.Account").

### 9. Use Tabs/Sections/Subgrids Enums

```typescript
// WRONG
formContext.ui.tabs.get("SUMMARY_TAB");
formContext.getControl("MySubgrid");

// CORRECT
import { AccountMainFormTabs as Tabs } from '../../typings/forms/account';
import { AccountMainFormSubgrids as Subgrids } from '../../typings/forms/account';
form.ui.tabs.get(Tabs.SUMMARYTAB);
form.getControl(Subgrids.MySubgrid);
```

### 10. No Xrm.Page (Deprecated Since D365 v9.0)

```typescript
// WRONG - deprecated since 2017
Xrm.Page.getAttribute("name");
Xrm.Page.data.save();

// CORRECT
const form = executionContext.getFormContext();
form.getAttribute("name");
form.data.save();
```

## RULES: Never Do This

- Never use `getAttribute("raw_string")` when a Fields enum exists
- Never use magic numbers for OptionSet values
- Never use `Xrm.Page` (deprecated)
- Never use synchronous XMLHttpRequest
- Never use `eval()`
- Never use `any` type without explicit justification
- Never skip error handling in async event handlers
- Never write `window.X = ...` (use module exports + esbuild globalName)

## Pattern Recognition: Legacy to XrmForge

When you see these patterns in legacy code, apply the XrmForge replacement:

| Legacy Pattern | XrmForge Replacement |
|---|---|
| `getAttribute("name")` | `getAttribute(Fields.Name)` |
| `getValue() === 595300000` | `getValue() === OptionSets.StatusCode.Active` |
| `Xrm.WebApi.retrieveRecord("account", id)` | `Xrm.WebApi.retrieveRecord(EntityNames.Account, id)` |
| `"?$select=name,revenue"` | `select(Fields.Name, Fields.Revenue)` from typegen/helpers |
| `value[0].id.replace("{","")...` | `parseLookup(...)` from typegen/helpers |
| `Xrm.Page.getAttribute(...)` | `formContext.getAttribute(...)` |
| `var formContext` (global) | `const form = ctx.getFormContext()` (parameter) |
| `.then(success, error)` | `async/await with try/catch` |

### Creating OptionSet Enums from Magic Numbers

When you find `getValue() === 105710002` in legacy code:
1. Collect ALL numeric comparisons with getValue()
2. Create a const enum in typings/optionsets/
3. Replace every magic number with the enum member

## Testing with Global Xrm Mock

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

All build config lives in `xrmforge.config.json`. No esbuild.config.ts needed.

```bash
npx xrmforge build          # Build all entries as IIFE bundles
npx xrmforge build --watch  # Watch mode (~10ms rebuilds)
```

## File Structure

```
src/forms/{entity}-form.ts     - One file per entity form
src/shared/{name}.ts           - Shared utilities
typings/                       - Generated types (do not edit)
tests/forms/{entity}.test.ts   - Tests per entity
xrmforge.config.json           - Build + generate config
```
