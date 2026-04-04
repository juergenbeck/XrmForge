# XrmForge Migration Guide

How to convert legacy Dynamics 365 JavaScript to type-safe TypeScript with XrmForge.

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
  --output ./typings
```

This generates:
- `typings/entities/*.d.ts` - Entity interfaces with typed attributes
- `typings/forms/*.d.ts` - Form interfaces with Fields enum, Tabs enum, Subgrid enum
- `typings/optionsets/*.d.ts` - OptionSet const enums with labels
- `typings/entity-names.d.ts` - EntityNames const enum

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
import { AccountMainFormFieldsEnum as Fields } from '../../typings/forms/account';

export function onLoad(executionContext: Xrm.Events.EventContext): void {
  const form = executionContext.getFormContext() as XrmForge.Forms.Account.AccountMainForm;

  // Fields enum: compile error on typos, autocomplete in IDE
  const name = form.getAttribute(Fields.AccountName);  // StringAttribute, not generic
  const status = form.getAttribute(Fields.StatusCode);  // OptionSetAttribute

  // OptionSet enum: no magic numbers
  if (status.getValue() === XrmForge.OptionSets.Account.StatusCode.Active) {
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

// After: use parseLookup from @xrmforge/typegen
import { parseLookup } from '@xrmforge/typegen/helpers';
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
import { select } from '@xrmforge/typegen/helpers';
import { AccountFields } from '../../typings/entities/account';
Xrm.WebApi.retrieveMultipleRecords("account",
  `?$select=${select(AccountFields.Name, AccountFields.Revenue)}&$filter=statecode eq 0`);
```

### Form Testing

```typescript
// Before: no tests, or complex manual mocks

// After: @xrmforge/testing
import { createFormMock, fireOnChange } from '@xrmforge/testing';
import type { AccountMainForm, AccountMainFormMockValues } from '../../typings/forms/account';

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

Replace with generated const enums from `typings/optionsets/`.

## Checklist

- [ ] All `getAttribute("string")` calls use Fields enum
- [ ] All OptionSet comparisons use const enums (no magic numbers)
- [ ] All `Xrm.Page` calls replaced with `formContext`
- [ ] Form scripts export functions (not global namespace objects)
- [ ] Each form script has tests using `@xrmforge/testing`
- [ ] `xrmforge build` produces IIFE bundles
- [ ] `tsc --noEmit` passes with zero errors
