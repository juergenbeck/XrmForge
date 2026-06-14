# @xrmforge/helpers Package

### 13.1 Problem

The previous approach used a `/helpers` subpath export on `@xrmforge/typegen`. This was confusing because typegen is a Node.js code generation tool, while helpers are browser-safe runtime utilities. The subpath `@xrmforge/typegen/helpers` was non-obvious and AI coding assistants consistently failed to discover it.

### 13.2 Solution

A standalone `@xrmforge/helpers` package consolidates all browser-safe runtime code. Zero Node.js dependencies. Clean, discoverable import path:

```typescript
// Import from the dedicated helpers package
import { select, parseLookup, typedForm } from '@xrmforge/helpers';
```

### 13.3 Exports

**Web API Helpers:**
- `select(...fields: string[]): string` - Builds `?$select=field1,field2`
- `selectExpand(fields: string[], expand: string): string` - Builds `?$select=...&$expand=...`
- `parseLookup(response: Record<string, unknown>, fieldName: string): LookupValue | null` - Parses `_fieldname_value` with OData annotations
- `parseLookups(response: Record<string, unknown>, fieldName: string): LookupValue[]` - Multi-value lookup parsing
- `parseFormattedValue(response: Record<string, unknown>, fieldName: string): string | null` - Extracts `@OData.Community.Display.V1.FormattedValue`

**Xrm Constants (8 const enums):**
- DisplayState, FormNotificationLevel, RequiredLevel, SubmitMode, SaveMode, ClientType, ClientState, OperationType

**typedForm() Proxy:**
- `typedForm<TForm>(formContext)` - Returns a proxy where `form.name` delegates to `getAttribute('name')`
- GET trap: Property access delegates to getAttribute(); `$context` returns raw FormContext; `controls.fieldName` returns the typed control (getControl())
- SET trap: Throws TypeError forcing `.setValue()` usage
- HAS trap: Checks if attribute exists on the form

**Action/Function Runtime:**
- `createBoundAction(entityName, actionName)` - Creates a bound action executor
- `executeRequest(request)` - Executes an Organization Request via Xrm.WebApi.online.execute
- `withProgress(message, fn)` - Wraps an async operation with Xrm.Utility.showProgressIndicator

### 13.4 Migration

The old import path `@xrmforge/typegen/helpers` has been removed. Update all imports:

```typescript
// Old (removed)
import { select } from '@xrmforge/typegen/helpers';
import { typedForm } from '@xrmforge/formhelpers';

// New
import { select, typedForm } from '@xrmforge/helpers';
```
