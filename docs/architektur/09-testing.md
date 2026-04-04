# 9. Test-Framework

## 9.1 createFormMock

```typescript
import { createFormMock } from '@xrmforge/testing';
import type { AccountMainForm, AccountMainFormMockValues } from '../typings/forms/account';

const mock = createFormMock<AccountMainForm, AccountMainFormMockValues>({
  name: 'Contoso Ltd',
  statuscode: 0,
  revenue: 1000000,
});

// Verwendung in Tests:
onLoad(mock.executionContext);
expect(mock.formContext.getControl('revenue').getVisible()).toBe(true);
```

**Was gemockt wird:**
- Attribute: MockAttribute-Instanzen mit getValue/setValue, Dirty-Tracking, onChange-Handlern, Required Level, Submit Mode
- Steuerelemente: MockControl-Instanzen mit Sichtbarkeits-/Deaktiviert-/Label-/Benachrichtigungszustand
- UI: Formular-Benachrichtigungen, Tab/Section-Stubs
- Entität: ID, Entitätsname, Primärattribut
- Daten: refresh(), save() Stubs, die Promise-ähnliches zurückgeben
- Navigation: openForm/openAlertDialog Stubs

**Lazy-Initialisierung:** Attribute, die über `getAttribute()` angesprochen werden und nicht in den initialen Werten enthalten waren, werden spontan mit null-Wert erstellt.

## 9.2 fireOnChange

```typescript
mock.fireOnChange('statuscode');
// Löst alle über getAttribute('statuscode').addOnChange(handler) registrierten Handler aus
```

Erstellt einen MockEventContext mit dem Attribut als Eventquelle.

## 9.3 setupXrmMock / teardownXrmMock

```typescript
import { setupXrmMock, teardownXrmMock } from '@xrmforge/testing';

beforeEach(() => setupXrmMock());
afterEach(() => teardownXrmMock());

// Mit WebApi-Überschreibungen:
setupXrmMock({
  webApiOverrides: {
    retrieveMultipleRecords: async () => ({ entities: [{ name: 'Test' }] }),
  },
});
```

Richtet ein globales `Xrm`-Objekt auf `globalThis` ein mit minimalen WebApi-, Navigation- und Utility-Stubs.
