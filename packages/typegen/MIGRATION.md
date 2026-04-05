# XrmForge Migration Guide

How to convert legacy Dynamics 365 JavaScript to type-safe TypeScript with XrmForge.

## Breaking Changes in v0.8.0 (ES Module Output)

### What changed
- Generated files are now `.ts` modules with `export` statements instead of `.d.ts` files with `declare namespace`
- Default output directory changed from `./typings` to `./generated`
- Entity Fields enums are now generated in a separate `fields/` directory
- Action declarations and runtime code are now in a single `.ts` file per group
- The barrel index uses `export * from` instead of `/// <reference path />`

### Migration steps
1. Update your `xrmforge generate` command: replace `--output ./typings` with `--output ./generated` (or omit for the new default)
2. Replace namespace access with imports:
   ```typescript
   // Before (v0.7.x):
   type AccountForm = XrmForge.Forms.Account.AccountMainForm;

   // After (v0.8.0):
   import type { AccountMainForm } from './generated/forms/account.js';
   ```
3. Update your tsconfig.json: replace `"typings/**/*.d.ts"` in `include` with `"generated/**/*.ts"`
4. Entity Fields enums are now available:
   ```typescript
   import { AccountFields } from './generated/fields/account.js';
   const result = await Xrm.WebApi.retrieveRecord('account', id, `?$select=${AccountFields.Name},${AccountFields.Telephone1}`);
   ```

## Breaking Changes in v0.7.0

- The `@xrmforge/typegen/helpers` subpath export has been removed.
- All browser-safe runtime code (`select`, `parseLookup`, `parseFormattedValue`,
  `withProgress`, Xrm constants, Action/Function executors, `typedForm`) is now
  in the new package `@xrmforge/helpers`.
- Update imports: `import { select } from '@xrmforge/typegen/helpers'` becomes
  `import { select } from '@xrmforge/helpers'`.
- `@xrmforge/formhelpers` has been removed. `typedForm()` is now in
  `@xrmforge/helpers`.

## Step 1: Initialize Project

```bash
npx @xrmforge/cli init my-project --prefix contoso
cd my-project
npm install
```

## Step 2: Generate Types from Dataverse

```bash
npx xrmforge generate \
  --url https://YOUR-ORG.crm4.dynamics.com \
  --auth interactive \
  --tenant-id YOUR-TENANT-ID \
  --client-id YOUR-CLIENT-ID \
  --entities account,contact,opportunity \
  --output ./generated
```

This generates:
- `generated/entities/*.ts` - Entity interfaces with typed attributes
- `generated/forms/*.ts` - Form interfaces with Fields enum, Tabs enum, Subgrid enum
- `generated/optionsets/*.ts` - OptionSet const enums with labels
- `generated/fields/*.ts` - Entity Fields enums for type-safe $select queries
- `generated/entity-names.ts` - EntityNames const enum

## Step 3: Convert Form Scripts

### Before (legacy JavaScript):

```javascript
// account.js - global functions, raw strings, no type safety
var LM = LM || {};
LM.Account = {
  onLoad: function(executionContext) {
    var formContext = executionContext.getFormContext();
    var name = formContext.getAttribute("name");           // generic Attribute
    var status = formContext.getAttribute("statuscode");
    if (status.getValue() === 1) {                         // magic number!
      formContext.getControl("revenue").setVisible(true);
    }
  }
};
```

### After (XrmForge TypeScript):

```typescript
// account-form.ts - typed, safe, autocomplete everywhere
import { AccountMainFormFieldsEnum as Fields } from '../../generated/forms/account.js';
import type { AccountMainForm } from '../../generated/forms/account.js';
import { StatusCode } from '../../generated/optionsets/account.js';

export function onLoad(executionContext: Xrm.Events.EventContext): void {
  const form = executionContext.getFormContext() as AccountMainForm;

  // Fields enum: compile error on typos, autocomplete in IDE
  const name = form.getAttribute(Fields.AccountName);  // StringAttribute, not generic
  const status = form.getAttribute(Fields.StatusCode);  // OptionSetAttribute

  // OptionSet enum: no magic numbers
  if (status.getValue() === StatusCode.Active) {
    form.getControl(Fields.Revenue).setVisible(true);
  }
}
```

### Key Differences:

| Legacy | XrmForge |
|--------|----------|
| `getAttribute("name")` | `getAttribute(Fields.AccountName)` |
| `getValue() === 1` | `getValue() === OptionSets.StatusCode.Active` |
| `formContext` (untyped) | `form as AccountMainForm` (typed) |
| `getControl("revenue")` | `getControl(Fields.Revenue)` |
| No compile-time checks | Typos are compile errors |

## Step 4: Replace Common Patterns

### Lookup Values

```typescript
// Before:
var value = formContext.getAttribute("primarycontactid").getValue();
var id = value[0].id.replace("{","").replace("}","");

// After: use parseLookup from @xrmforge/helpers
import { parseLookup } from '@xrmforge/helpers';
const contact = parseLookup(form.getAttribute(Fields.PrimaryContactId));
if (contact) {
  console.log(contact.id);  // already clean GUID
}
```

### Web API Queries

```typescript
// Before:
Xrm.WebApi.retrieveMultipleRecords("account",
  "?$select=name,revenue&$filter=statecode eq 0");

// After: use Fields enum for $select
import { select } from '@xrmforge/helpers';
import { AccountFields } from '../../generated/fields/account.js';
Xrm.WebApi.retrieveMultipleRecords("account",
  `?$select=${select(AccountFields.Name, AccountFields.Revenue)}&$filter=statecode eq 0`);
```

### Form Testing

```typescript
// Before: no tests, or complex manual mocks

// After: @xrmforge/testing
import { createFormMock, fireOnChange } from '@xrmforge/testing';
import type { AccountMainForm, AccountMainFormMockValues } from '../../generated/forms/account.js';

const mock = createFormMock<AccountMainForm, AccountMainFormMockValues>({
  name: 'Contoso Ltd',
  revenue: 1000000,
  statuscode: 1,
});

onLoad(mock.executionContext);
expect(mock.formContext.getControl('revenue').getVisible()).toBe(true);
```

## Step 5: Build

```bash
npx xrmforge build          # IIFE bundles for D365
npx xrmforge build --watch  # Watch mode
```

## Step 6: Replace Magic Numbers

Search your code for patterns like:
- `getValue() === 123` or `getValue() !== 456`
- `setValue("statuscode", 1)`
- Raw OptionSet values in if/switch statements

Replace with generated const enums from `generated/optionsets/`.

## Checklist

- [ ] All `getAttribute("string")` calls use Fields enum
- [ ] All OptionSet comparisons use const enums (no magic numbers)
- [ ] All `Xrm.Page` calls replaced with `formContext`
- [ ] Form scripts export functions (not global namespace objects)
- [ ] Each form script has tests using `@xrmforge/testing`
- [ ] `xrmforge build` produces IIFE bundles
- [ ] `tsc --noEmit` passes with zero errors
