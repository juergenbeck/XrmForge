# XrmForge - AI Agent Instructions

## Quality Philosophy

The goal is not "code that compiles" or "code that passes a linter". The goal is
code that reads like a description of the business logic. A developer opening a
file should immediately understand what happens, without Xrm API docs, without
OData knowledge, without deciphering GUIDs or magic numbers.

Every string that references a Dataverse resource (field name, entity name,
OptionSet value, tab name, section name, notification ID, navigation property)
MUST come from a generated constant or a named constant from constants.ts.
No exceptions. No workarounds. No helper wrappers that accept raw strings.

Abstraction layers that merely wrap single API calls with string parameters
(getValue, setValue, setDisabled, addOnChange) destroy type safety and must not
exist. The correct abstraction is `typedForm()` (language-level proxy), not
string wrappers (API-level indirection). Business logic belongs in named
functions with domain-specific names, not in anonymous chains of API calls.

## Packages

- `@xrmforge/typegen` - Generates typed declarations from Dataverse metadata (Node.js CLI only, NEVER import in browser code)
- `@xrmforge/helpers` - Browser-safe runtime: typedForm(), select(), parseLookup(), formLookup(), Xrm constants, Action executors
- `@xrmforge/testing` - Type-safe form mocks: createFormMock(), fireOnChange(), setupXrmMock()
- `@xrmforge/devkit` - esbuild IIFE bundles via xrmforge build
- `@xrmforge/eslint-plugin` - D365-specific ESLint rules

## Generated Types (generated/ directory)

Run `xrmforge generate` to create:
- `generated/forms/{entity}.ts` - Form interface + Fields/Tabs/Sections/Subgrids enums
- `generated/optionsets/{entity}.ts` - OptionSet const enums
- `generated/entities/{entity}.ts` - Entity interface (for Web API response typing)
- `generated/fields/{entity}.ts` - Entity Fields enum for type-safe $select queries
- `generated/entity-names.ts` - EntityNames const enum
- `generated/actions/global.ts` - Custom API Action executors (typed params + results)
- `generated/functions/global.ts` - Custom API Function executors
- `generated/form-mapping.json` - Entity to form interface mapping (read after generate!)
- `generated/index.ts` - Barrel file with `export * from` re-exports

**After generate:** Read `generated/form-mapping.json` for the mapping of entity logical
names to form interface names. Do NOT guess interface names from entity names.
Fields enum member names are based on the **primary language label** (often German),
not the logical field name. Always read the generated files to get correct names.

**System entities:** If a form script needs an entity NOT in the generated EntityNames
(e.g. transactioncurrency, pricelevel, uom, systemuser), re-run generate with
`--entities transactioncurrency,pricelevel,...` to include them. NEVER create a local
`SystemEntities` object with raw strings as a workaround.

## Rules: MANDATORY (every violation is a bug)

### 1. typedForm() for ALL field access (primary pattern)

Use `typedForm<FormInterface>(formContext)` from `@xrmforge/helpers` to create a
typed proxy. Access fields as direct properties instead of getAttribute chains.

```typescript
import { typedForm } from '@xrmforge/helpers';
import type { AccountLMFirmaForm } from '../../generated/forms/account.js';
import { AccountLMFirmaFormFieldsEnum as Fields } from '../../generated/forms/account.js';

export const onLoad = wrapHandler('LM.Account.onLoad', logger, (ctx) => {
  const form = typedForm<AccountLMFirmaForm>(ctx.getFormContext());

  // Direct field access - fully typed, IDE autocomplete works
  const name = form.name?.getValue();              // string | null | undefined
  form.revenue?.setValue(150000);                   // NumberAttribute | null
  const parent = form.parentaccountid?.getValue();  // LookupValue[] | null | undefined

  // Control access
  form.$control('name').setDisabled(true);

  // Full FormContext for ui, data, tabs, addOnChange
  form.$context.ui.setFormNotification('OK', FormNotificationLevel.Info, 'id');
  form.$context.getAttribute(Fields.Name).addOnChange(() => { ... });
});
```

**When to use `form.$context.getAttribute(Fields.X)` instead of `form.fieldname`:**
- `addOnChange()`, `removeOnChange()` (event registration on the attribute)
- `setRequiredLevel()`, `setSubmitMode()` (attribute-level settings)
- `getControl()` with typed control access (use `form.$control(Fields.X)`)

**When to use `form.fieldname` (the typedForm proxy):**
- `getValue()`, `setValue()` (reading and writing values)
- Any read-only access to field values

### 2. Fields Enum for ALL getAttribute/getControl AND select() calls

Two types of Fields enums exist:
- **Form-level**: `AccountLMFirmaFormFieldsEnum` (from `generated/forms/`) - for getAttribute/getControl on the form
- **Entity-level**: `AccountFields` (from `generated/fields/`) - for Web API $select queries

```typescript
// Form field access (form-level Fields):
import { AccountLMFirmaFormFieldsEnum as Fields } from '../../generated/forms/account.js';
form.$context.getAttribute(Fields.Name).addOnChange(() => { ... });

// Web API queries (entity-level Fields):
import { AccountFields } from '../../generated/fields/account.js';
Xrm.WebApi.retrieveRecord(EntityNames.Account, id,
  select(AccountFields.Name, AccountFields.WebsiteUrl));
```

**NEVER use raw strings in select():**
```typescript
select('name', 'websiteurl')                     // BUG - raw strings
select(AccountFields.Name, AccountFields.WebsiteUrl) // CORRECT
```

### 3. OptionSet Enum for ALL value comparisons AND FetchXML

Never use magic numbers. Not in comparisons, not in FetchXML, not anywhere.

```typescript
import { InvoiceStatusCode } from '../../generated/optionsets/invoice.js';

// Comparisons:
if (status === InvoiceStatusCode.Gebucht) { ... }     // CORRECT
if (status === 105710002) { ... }                       // BUG

// FetchXML:
`<condition attribute='${InvoiceFields.Statuscode}' operator='in'>
  <value>${InvoiceStatusCode.Aktiv}</value>
  <value>${InvoiceStatusCode.Gebucht}</value>
</condition>`                                          // CORRECT

`<condition attribute='statuscode' operator='in'>
  <value>1</value><value>105710002</value>
</condition>`                                          // BUG - raw strings AND magic numbers
```

### 4. EntityNames Enum in ALL Xrm.WebApi calls

No exceptions, even for system entities. If missing, extend generation.

```typescript
import { EntityNames } from '../../generated/entity-names.js';
Xrm.WebApi.retrieveRecord(EntityNames.Account, id, query);
```

### 5. Lookup helpers from @xrmforge/helpers

```typescript
import { formLookup, formLookupId, parseLookup } from '@xrmforge/helpers';
// Form (via typedForm proxy):
const customer = formLookup(form.parentaccountid);
const customerId = formLookupId(form.parentaccountid);
// Web API response (use NavigationProperties enum, NOT raw strings):
import { AccountNavigationProperties as AccountNav } from '../../generated/entities/account.js';
const parent = parseLookup(apiResponse, AccountNav.ParentAccountId);
```

### 6. select(), $filter, $expand, $orderby with Fields Enums

ALL OData query parts must use entity-level Fields Enums. No raw field name strings anywhere.

```typescript
import { select, selectExpand } from '@xrmforge/helpers';
import { AccountFields } from '../../generated/fields/account.js';

// $select:
select(AccountFields.Name, AccountFields.Revenue)

// $filter (field names via template literal):
`${select(AccountFields.Name)}&$filter=${AccountFields.Statecode} eq 0`

// $expand (navigation properties):
selectExpand(
  [AccountFields.Name, AccountFields.Revenue],
  `primarycontactid($select=${ContactFields.Fullname})`,
)

// $orderby:
`${select(AccountFields.Name)}&$orderby=${AccountFields.Name} asc`
```

### 6b. Web API response typing with generated Entity interfaces

Always type Web API responses with generated Entity interfaces. Never access properties with `as string` casts.

```typescript
import type { Account } from '../../generated/entities/account.js';

const result = await Xrm.WebApi.retrieveRecord(
  EntityNames.Account, id, select(AccountFields.Name)
) as Account;
result.name  // typed as string | null, no cast needed
```

### 7. wrapHandler() around EVERY exported handler

```typescript
export const onLoad = wrapHandler('Namespace.Entity.onLoad', logger, async (ctx) => {
  const form = typedForm<MyForm>(ctx.getFormContext());
  // ...
});
```

### 8. Custom API Executors from generated/actions/

Never build your own ExecuteFunctionCall wrapper. Use the generated executors:

```typescript
import { CreateEMailFromInvoice } from '../../generated/actions/global.js';
import { withProgress } from '@xrmforge/helpers';

const result = await withProgress(
  CreateEMailFromInvoice.execute({ InvoiceId: recordId }),
  { title: 'E-Mail wird erstellt...' }
);
// result.EmailId is typed as string
```

### 9. Named constants for ALL non-obvious values

```typescript
const MS_PER_DAY = 24 * 60 * 60 * 1000;
form.lm_zahlungsziel.setValue(new Date(date.getTime() + days * MS_PER_DAY));
// NEVER: new Date(date.getTime() + days * 86400000)
```

### 10. Localized UI strings via pickLang()

All user-visible strings MUST go through `pickLang()` in constants.ts:

```typescript
// constants.ts:
export const MESSAGES = {
  de: { titlePlaceholder: '[Kurzbeschreibung der Anfrage]' },
  en: { titlePlaceholder: '[Brief description]' },
} as const;
export function pickLang<K extends string>(languageId: number, table: { de: Record<K, string>; en: Record<K, string> }): Record<K, string>;

// form script:
import { MESSAGES, pickLang } from '../shared/constants.js';
const lang = pickLang(Xrm.Utility.getGlobalContext().userSettings.languageId, MESSAGES);
form.title.setValue(lang.titlePlaceholder);
```

### 11. Tabs, Sections, Subgrids via generated enums

Never use raw strings for tab, section, or subgrid names:

```typescript
import { AccountLMFirmaFormTabs as Tabs } from '../../generated/forms/account.js';
import { AccountLMFirmaFormSUMMARYTABSections as SummarySections } from '../../generated/forms/account.js';
import { AccountLMFirmaFormSubgrids as Subgrids } from '../../generated/forms/account.js';

form.$context.ui.tabs.get(Tabs.SUMMARYTAB).setVisible(true);
form.$context.ui.tabs.get(Tabs.SUMMARYTAB).sections.get(SummarySections.General).setVisible(false);
(form.$context.getControl(Subgrids.Orders) as Xrm.Controls.GridControl).refresh();
```

### 12. Notification IDs from NOTIFICATION_IDS

All notification unique IDs must be in `constants.ts`, never inline raw strings:

```typescript
// constants.ts:
export const NOTIFICATION_IDS = {
  genericError: 'lmapp.notification.generic-error',
  saveWarning: 'lmapp.notification.save-warning',
  addressMissing: 'lmapp.notification.address-missing',
} as const;

// form script:
form.$context.ui.setFormNotification(msg, FormNotificationLevel.Error, NOTIFICATION_IDS.genericError);
```

### 13. Xrm constants from @xrmforge/helpers for ALL Xrm enum values

Never use raw strings or magic numbers for Xrm API constants:

```typescript
import { SaveMode, FormNotificationLevel, RequiredLevel, SubmitMode, DisplayState } from '@xrmforge/helpers';

// Save mode:
if (ctx.getEventArgs().getSaveMode() === SaveMode.AutoSave) { ... }  // not === 70

// Form type (const enum from @types/xrm, works at runtime):
if (form.$context.ui.getFormType() === XrmEnum.FormType.Create) { ... }  // not === 1

// Display state:
if (tab.getDisplayState() === DisplayState.Expanded) { ... }  // not === 'expanded'

// Required level:
form.$context.getAttribute(Fields.Name).setRequiredLevel(RequiredLevel.Required);  // not 'required'

// Submit mode:
form.$context.getAttribute(Fields.Name).setSubmitMode(SubmitMode.Always);  // not 'always'

// Notification level:
form.$context.ui.setFormNotification(msg, FormNotificationLevel.Error, id);  // not 'ERROR'
```

### 14. EntityNames in openForm and ALL entity references

```typescript
// openForm:
Xrm.Navigation.openForm({ entityName: EntityNames.Account, entityId: id });  // not "account"

// openWebResource, openUrl, etc.: use EntityNames wherever an entity name appears
```

### 15. Module exports, Structured Logger, createFormMock

- Module exports (not window/global assignments). esbuild globalName handles namespacing.
- `createLogger()` instead of console.* (except in logger.ts itself)
- `createFormMock()` from @xrmforge/testing for ALL form tests

## Rules: NEVER (every occurrence is a bug)

**Field/Entity/Resource names:**
- Never raw strings in `getAttribute()`, `getControl()`, `select()`, `$filter`, `$expand`, `$orderby`, `parseLookup()`, FetchXML `attribute=`, or any function that takes a field name
- Never raw entity name strings in `Xrm.WebApi`, `Xrm.Navigation.openForm`, or anywhere an entity name appears (use `EntityNames`)
- Never raw tab/section/subgrid names (use generated Tabs/Sections/Subgrids enums)
- Never raw notification IDs (use `NOTIFICATION_IDS` from constants.ts)
- Never create `SystemEntities` objects with raw strings (extend generation with `--entities`)

**Magic values:**
- Never magic numbers for OptionSet values, status codes, or FetchXML `<value>` (use OptionSet Enums)
- Never magic numbers for time calculations (use named constants like `MS_PER_DAY`)
- Never `getSaveMode() === 70` (use `SaveMode.AutoSave` from @xrmforge/helpers)
- Never `getFormType() === 1` (use `XrmEnum.FormType.Create`)
- Never `'expanded'`/`'collapsed'` (use `DisplayState` from @xrmforge/helpers)
- Never `'ERROR'`/`'INFO'`/`'WARNING'` (use `FormNotificationLevel`)
- Never `'none'`/`'required'`/`'recommended'` (use `RequiredLevel`)
- Never `'always'`/`'dirty'` (use `SubmitMode`)

**Web API responses:**
- Never access WebApi response properties with `as string` casts (use generated Entity interfaces)
- Never `.getValue()[0].id` for lookups (use `formLookup`/`formLookupId`)
- Never raw strings in `parseLookup()` (use NavigationProperties enum)

**Code quality:**
- Never `Xrm.Page` (deprecated since D365 v9.0)
- Never `eval()`, never synchronous XMLHttpRequest
- Never `window.X = ...` (use module exports)
- Never `console.log/warn/error` in form scripts (use shared logger)
- Never export handlers without `wrapHandler()`
- Never unlokalized UI strings (use `pickLang()` from constants.ts)
- Never build your own getValue/setFieldValue/setDisabled/addOnChange helpers (use `typedForm` + native Xrm API)
- Never `import ... from '@xrmforge/typegen'` in browser code (use `@xrmforge/helpers`)
- Never `as any` without eslint-disable comment explaining why
- Never untyped `catch (error)` (always `catch (error: unknown)`)

## Subagent Handoff (when delegating to sub-agents)

Copy these MANDATORY rules into every sub-agent prompt:

```
1. typedForm<FormType>(ctx.getFormContext()) for ALL field access
2. Entity-level Fields Enums in ALL select(), $filter, $expand, $orderby, FetchXML attribute=
3. OptionSet Enum for ALL value comparisons AND FetchXML <value> (never magic numbers)
4. EntityNames for ALL Xrm.WebApi calls AND openForm (never raw entity names)
5. formLookup/formLookupId for ALL lookup access (never .getValue()[0].id)
6. parseLookup with NavigationProperties enum (never raw nav property strings)
7. Generated Entity interfaces for ALL WebApi response typing (never as string casts)
8. Tabs/Sections/Subgrids enums for ALL UI structure access (never raw strings)
9. SaveMode/FormType/DisplayState/RequiredLevel/SubmitMode/FormNotificationLevel constants
10. wrapHandler() around EVERY exported handler
11. createLogger() instead of console.* (except logger.ts)
12. Custom API Executors from generated/actions/ (never build your own)
13. NOTIFICATION_IDS from constants.ts for all notification unique IDs
14. Named constants for non-obvious values (never magic numbers like 86400000)
15. pickLang() for all user-visible strings (never hardcoded German/English)
```

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
export function wrapHandler(name: string, logger: Logger, handler: EventHandler): EventHandler;
export function wrapCommand(name: string, logger: Logger, handler: CommandHandler): CommandHandler;
// Catches sync+async errors, shows form notification via FormNotificationLevel.Error
```

### constants.ts
```typescript
export const NOTIFICATION_IDS = { ... } as const;
export const MESSAGES = { de: { ... }, en: { ... } } as const;
export function pickLang<K extends string>(languageId: number, table: ...): Record<K, string>;
```

## Before/After Examples

### Field Access (primary pattern: typedForm)
```typescript
// BEFORE (legacy):
formContext.getAttribute("name").getValue()
// BEFORE (getAttribute + Fields):
form.getAttribute(Fields.Name).getValue()
// AFTER (typedForm - preferred):
const form = typedForm<AccountForm>(ctx.getFormContext());
form.name?.getValue()
```

### Web API Query
```typescript
// BEFORE:
Xrm.WebApi.retrieveRecord("account", id, "?$select=name,revenue")
// AFTER:
import { AccountFields } from '../../generated/fields/account.js';
Xrm.WebApi.retrieveRecord(EntityNames.Account, id,
  select(AccountFields.Name, AccountFields.Revenue))
```

### OptionSet Comparison
```typescript
// BEFORE: if (status.getValue() === 595300002) { ... }
// AFTER:
import { StatusCode } from '../../generated/optionsets/invoice.js';
if (form.statuscode?.getValue() === StatusCode.Gebucht) { ... }
```

### FetchXML
```typescript
// BEFORE:
`<condition attribute='statuscode' operator='in'><value>1</value><value>105710000</value></condition>`
// AFTER:
import { LmBestellungFields } from '../../generated/fields/lm_bestellung.js';
import { LmBestellungStatusCode } from '../../generated/optionsets/lm_bestellung.js';
`<condition attribute='${LmBestellungFields.Statuscode}' operator='in'>
  <value>${LmBestellungStatusCode.Aktiv}</value>
  <value>${LmBestellungStatusCode.InArbeit}</value>
</condition>`
```

### Lookup Access
```typescript
// BEFORE: form.getAttribute("customerid").getValue()[0].id.replace("{","").replace("}","")
// AFTER:
const customerId = formLookupId(form.customerid);
```

### Custom API Call
```typescript
// BEFORE: ExecuteFunctionCall("CancelInvoice", { InvoiceId: id })
// AFTER:
import { CancelInvoice } from '../../generated/actions/global.js';
const result = await withProgress(
  CancelInvoice.execute({ InvoiceId: id }),
  { title: 'Rechnung wird storniert...' }
);
```

### Date Calculation
```typescript
// BEFORE: new Date(date.getTime() + nettotage * 86400000)
// AFTER:
const MS_PER_DAY = 24 * 60 * 60 * 1000;
new Date(date.getTime() + nettotage * MS_PER_DAY)
```

### UI Strings
```typescript
// BEFORE: form.title.setValue('[Kurzbeschreibung der Anfrage]')
// AFTER:
const lang = pickLang(Xrm.Utility.getGlobalContext().userSettings.languageId, MESSAGES);
form.title.setValue(lang.titlePlaceholder);
```

## Testing (onLoad + onChange)

```typescript
import { createFormMock, setupXrmMock, teardownXrmMock } from '@xrmforge/testing';

beforeEach(() => setupXrmMock());
afterEach(() => teardownXrmMock());

// onLoad test:
const mock = createFormMock<AccountMainForm>({ name: 'Test', statuscode: 0 });
onLoad(mock.asEventContext());
expect(mock.getControl(Fields.Revenue).getVisible()).toBe(true);

// onChange test (MANDATORY for every onChange handler):
mock.setValue(Fields.Revenue, 500000);
mock.fireOnChange(Fields.Revenue);
expect(mock.getControl(Fields.CreditLimit).getVisible()).toBe(true);
```

**Test quality rule:** At least 30% of tests MUST use `fireOnChange` or WebApi mock
assertions. Pure smoke tests (`onLoad` + `not.toThrow`) do NOT count.
Every onChange handler MUST have a `fireOnChange` test.

**attr.controls:** Since @xrmforge/testing 0.2.3, `createFormMock()` automatically links
each attribute to its control. `mock.getControl(Fields.Name)` works out of the box.

## Pattern Recognition: Legacy to XrmForge

### Xrm API Patterns
| Legacy Pattern | XrmForge Replacement |
|---|---|
| `getAttribute("name")` | `form.name` (via typedForm) |
| `getControl("name")` | `form.$control(Fields.Name)` |
| `Xrm.Page.getAttribute(...)` | `form.fieldname` (via typedForm) |
| `var formContext` (global) | `const form = typedForm<MyForm>(ctx.getFormContext())` |
| `function form_OnLoad(ctx)` | `export const onLoad = wrapHandler(...)` |
| `Xrm.WebApi.retrieveRecord("account", id)` | `Xrm.WebApi.retrieveRecord(EntityNames.Account, id)` |
| `"?$select=name,revenue"` | `select(AccountFields.Name, AccountFields.Revenue)` |
| `value[0].id.replace("{","")` | `formLookupId(form.customerid)` |
| `ExecuteFunctionCall("name", ...)` | `import { Name } from '../../generated/actions/global.js'` |
| `setFormNotification(msg, 'ERROR', id)` | `setFormNotification(msg, FormNotificationLevel.Error, id)` |
| `getValue() === 595300000` | `form.statuscode?.getValue() === StatusCode.Active` |
| `86400000` | `const MS_PER_DAY = 24 * 60 * 60 * 1000` |
| `'[Kurzbeschreibung]'` | `pickLang(languageId, MESSAGES).placeholder` |

### Legacy Helper Functions (DO NOT recreate, use typedForm instead)

These helper wrappers are common in legacy code. They destroy type safety.
Never recreate them. Use the typed API directly.

| Legacy Helper | XrmForge Replacement |
|---|---|
| `GetValue(fieldName)` | `form.fieldname?.getValue()` (typed via typedForm) |
| `SetValue(fieldName, value)` | `form.fieldname.setValue(value)` (typed via typedForm) |
| `SetDisabled(attributeName, disabled)` | `form.$control(Fields.X).setDisabled(disabled)` |
| `SetVisible(attributeName, visible)` | `form.$control(Fields.X).setVisible(visible)` |
| `SetRequiredLevel(attributeName, level)` | `form.$context.getAttribute(Fields.X).setRequiredLevel(RequiredLevel.Required)` |
| `AddOnChange(attributeName, callback)` | `form.$context.getAttribute(Fields.X).addOnChange(cb)` |
| `AddPreSearch(controlName, callback)` | `(form.$control(Fields.X) as Xrm.Controls.LookupControl).addPreSearch(cb)` |
| `GetLookupValueId(fieldName)` | `formLookupId(form.fieldname)` |
| `SetLookupValue(field, id, type, name)` | `form.fieldname.setValue([{ id, entityType, name }])` |
| `GetId()` | `form.$context.data.entity.getId()` |
| `GetEntityName()` | `form.$context.data.entity.getEntityName()` |
| `GetFormType()` | `form.$context.ui.getFormType()` |
| `GetIsDirty()` | `form.$context.data.entity.getIsDirty()` |
| `IsNullOrEmpty(value)` | `value == null \|\| value === ''` (inline) |
| `IsAttributeNullOrEmpty(field)` | `form.fieldname?.getValue() == null` |
| `GetUserId()` | `Xrm.Utility.getGlobalContext().userSettings.userId` |
| `GetUserLanguageId()` | `Xrm.Utility.getGlobalContext().userSettings.languageId` |
| `OpenForm(entityName, id)` | `Xrm.Navigation.openForm({ entityName: EntityNames.X, entityId: id })` |
| `OpenAlertDialog(text)` | `Xrm.Navigation.openAlertDialog({ text })` |
| `OpenConfirmDialog(text, ...)` | `Xrm.Navigation.openConfirmDialog({ text, title, ... })` |
| `ShowProgressIndicator(msg)` | `Xrm.Utility.showProgressIndicator(msg)` |
| `CloseProgressIndicator()` | `Xrm.Utility.closeProgressIndicator()` |
| `SetNotification(attr, msg)` | `form.$context.getControl(Fields.X).setNotification(msg, NOTIFICATION_IDS.x)` |
| `SetSectionDisabled(tab, sec, off)` | `form.$context.ui.tabs.get(Tabs.X).sections.get(Sections.Y).setVisible(!off)` |

### GUID Handling (common CRM anti-pattern)

D365 returns GUIDs in various formats: `{A1B2C3D4-...}`, `a1b2c3d4-...`, `A1B2C3D4-...`.
Legacy code commonly has helpers like `CompareGuid()`, `GetCompatibleGuid()`,
`NormalizeGuid()`, `StripBraces()`. **Do NOT recreate these.**

`formLookupId()` from @xrmforge/helpers already normalizes GUIDs (removes braces).
GUID comparison is then a simple `===`:

```typescript
// WRONG: legacy GUID helpers
function CompareGuid(a, b) { return a.replace(/[{}]/g,'').toLowerCase() === b.replace(/[{}]/g,'').toLowerCase(); }
const id = GetCompatibleGuid(form.getAttribute("customerid").getValue()[0].id);

// CORRECT: formLookupId normalizes automatically
const customerId = formLookupId(form.customerid);  // already clean: "a1b2c3d4-..."
if (customerId === otherNormalizedId) { ... }       // simple ===
```

### Typed repetition beats untyped loops

When multiple fields need the same operation (e.g. 8 address fields), write
8 typed lines instead of 1 loop with raw strings:

```typescript
// WRONG: DRY reflex, but raw strings bypass type safety
for (const f of ['address1_name', 'address1_line1', 'address1_city']) {
  form.$unsafe(f)?.addOnChange(handler);
}

// CORRECT: more lines, but every field is compile-time validated
form.address1_name?.addOnChange(handler);
form.address1_line1?.addOnChange(handler);
form.address1_city?.addOnChange(handler);
form.address1_postalcode?.addOnChange(handler);
form.address1_country?.addOnChange(handler);
```

8 typed lines are better than 1 loop with raw strings. The type system
catches renamed/removed fields at compile time. A loop with raw strings
only fails at runtime. DRY is a recommendation, type safety is mandatory.

**Rule of thumb:** If a helper function just wraps a single Xrm API call with a
string parameter, it MUST NOT exist. The typed API is shorter, safer, and provides
IDE autocomplete. Only keep shared helpers that contain actual domain logic
(calculations, WebApi queries, multi-step workflows).

## @types/xrm Pitfalls (known issues)

1. **Form Interface:** Do NOT use `interface extends Xrm.FormContext`. Use `Omit` pattern.
2. **AlertDialogResponse** does NOT exist. Use `Xrm.Async.PromiseLike<void>`.
3. **ConfirmDialogResponse** does NOT exist. Use `Xrm.Navigation.ConfirmResult`.
4. **setNotification()** requires 2 arguments: (message, uniqueId).
5. **openFile()** requires `fileSize` property in FileDetails.
6. **Grid.refresh()** requires `(grid as any).refresh()` with eslint-disable comment.

## Build

```bash
npx xrmforge build               # IIFE bundles for D365
npx xrmforge build --watch        # Watch mode (~10ms rebuilds)
```

## File Structure

```
src/forms/{entity}-form.ts       - Form scripts (one per entity)
src/shared/logger.ts             - Structured logger (only file with console.*)
src/shared/error-handler.ts      - wrapHandler + wrapCommand
src/shared/constants.ts          - NOTIFICATION_IDS, MESSAGES, pickLang
generated/                       - Generated types (do not edit manually)
tests/forms/{entity}.test.ts     - Tests
xrmforge.config.json             - Build config
scripts/validate-form.mjs        - Quality gate (run after each batch)
```

## Self-Check (MANDATORY before Tests)

Run `node scripts/validate-form.mjs` after every batch. Must report 0 violations.
