# 13. typegen/helpers Subpath

## 13.1 Problem

Der Import vom Haupt-Einstiegspunkt von `@xrmforge/typegen` zieht Node.js-Abhängigkeiten (`fs`, `path`, `@azure/identity`) mit. Das bricht esbuild-Browser-Bundles:

```typescript
// FALSCH - zieht Node.js-Abhängigkeiten, bricht esbuild
import { select, parseLookup } from '@xrmforge/typegen';
```

## 13.2 Lösung

Der `/helpers`-Subpath exportiert ausschliesslich browsersicheren Code ohne Node.js-Abhängigkeiten:

```typescript
// RICHTIG - browsersicher, keine Node.js-Abhängigkeiten
import { select, parseLookup } from '@xrmforge/typegen/helpers';
```

## 13.3 Exports

**Web-API-Helpers:**
- `select(...fields: string[]): string` - Erstellt `?$select=field1,field2`
- `selectExpand(fields: string[], expand: string): string` - Erstellt `?$select=...&$expand=...`
- `parseLookup(response: Record<string, unknown>, fieldName: string): LookupValue | null` - Parst `_fieldname_value` mit OData-Annotationen
- `parseLookups(response: Record<string, unknown>, fieldName: string): LookupValue[]` - Multi-Value-Lookup-Parsing
- `parseFormattedValue(response: Record<string, unknown>, fieldName: string): string | null` - Extrahiert `@OData.Community.Display.V1.FormattedValue`

**Xrm-Konstanten (8 const enums):**
- DisplayState, FormNotificationLevel, RequiredLevel, SubmitMode, SaveMode, ClientType, ClientState, OperationType

## 13.4 Adoptionslücke

Obwohl in der AGENT.md Pattern-Erkennungstabelle dokumentiert, verwendet kein KI-Coding-Assistent konsistent die `/helpers`-Imports. Dies ist die grösste verbleibende Lücke in XrmForges KI-gesteuerter Codegenerierung.
