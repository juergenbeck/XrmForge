# typegen/helpers Subpath

### 13.1 Problem

Importing from the main `@xrmforge/typegen` entry point pulls in Node.js dependencies (`fs`, `path`, `@azure/identity`). This breaks esbuild browser bundles:

```typescript
// WRONG - pulls in Node.js deps, breaks esbuild
import { select, parseLookup } from '@xrmforge/typegen';
```

### 13.2 Solution

The `/helpers` subpath exports only browser-safe code with zero Node.js dependencies:

```typescript
// CORRECT - browser-safe, no Node.js deps
import { select, parseLookup } from '@xrmforge/typegen/helpers';
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

### 13.4 Adoption Gap

Despite being documented in the AGENT.md Pattern Recognition table, no AI coding assistant consistently uses the `/helpers` imports. This is the biggest remaining gap in XrmForge's AI-driven code generation.
