# 13. @xrmforge/helpers Package

## 13.1 Problem

Der bisherige Ansatz nutzte einen `/helpers`-Subpath-Export auf `@xrmforge/typegen`. Das war verwirrend, weil typegen ein Node.js-Codegenerierungstool ist, während die Helpers browsersichere Laufzeitfunktionen sind. Der Subpath `@xrmforge/typegen/helpers` war nicht intuitiv und KI-Coding-Assistenten haben ihn durchgängig nicht gefunden.

## 13.2 Lösung

Ein eigenständiges `@xrmforge/helpers`-Package bündelt allen browsersicheren Laufzeitcode. Keine Node.js-Abhängigkeiten. Klarer, auffindbarer Import-Pfad:

```typescript
// Import vom dedizierten helpers-Package
import { select, parseLookup, typedForm } from '@xrmforge/helpers';
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

**typedForm()-Proxy:**
- `typedForm<TForm>(formContext)` - Gibt einen Proxy zurück, bei dem `form.name` an `getAttribute('name')` delegiert
- GET-Trap: Property-Zugriff delegiert an getAttribute(); `$context` gibt den rohen FormContext zurück; `controls.fieldName` gibt das typisierte Control zurück (getControl())
- SET-Trap: Wirft TypeError und erzwingt die Verwendung von `.setValue()`
- HAS-Trap: Prüft, ob ein Attribut auf dem Formular existiert

**Action/Function-Laufzeit:**
- `createBoundAction(entityName, actionName)` - Erstellt einen gebundenen Action-Executor
- `executeRequest(request)` - Führt einen Organization Request über Xrm.WebApi.online.execute aus
- `withProgress(message, fn)` - Umhüllt eine asynchrone Operation mit Xrm.Utility.showProgressIndicator

## 13.4 Migration

Der alte Import-Pfad `@xrmforge/typegen/helpers` wurde entfernt. Alle Imports aktualisieren:

```typescript
// Alt (entfernt)
import { select } from '@xrmforge/typegen/helpers';
import { typedForm } from '@xrmforge/formhelpers';

// Neu
import { select, typedForm } from '@xrmforge/helpers';
```
