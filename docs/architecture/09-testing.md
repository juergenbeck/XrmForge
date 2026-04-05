# Testing Framework

### 9.1 createFormMock

```typescript
import { createFormMock } from '@xrmforge/testing';
import type { AccountMainForm, AccountMainFormMockValues } from '../generated/forms/account';

const mock = createFormMock<AccountMainForm, AccountMainFormMockValues>({
  name: 'Contoso Ltd',
  statuscode: 0,
  revenue: 1000000,
});

// Use in tests:
onLoad(mock.executionContext);
expect(mock.formContext.getControl('revenue').getVisible()).toBe(true);
```

**What it mocks:**
- Attributes: MockAttribute instances with getValue/setValue, dirty tracking, onChange handlers, required level, submit mode
- Controls: MockControl instances with visible/disabled/label/notification state
- UI: Form notifications, tab/section stubs
- Entity: ID, entity name, primary attribute
- Data: refresh(), save() stubs returning Promise-like
- Navigation: openForm/openAlertDialog stubs

**Lazy initialization:** Attributes accessed via `getAttribute()` that were not in the initial values are created on-the-fly with null value.

### 9.2 fireOnChange

```typescript
mock.fireOnChange('statuscode');
// Triggers all handlers registered via getAttribute('statuscode').addOnChange(handler)
```

Creates a MockEventContext with the attribute as event source.

### 9.3 setupXrmMock / teardownXrmMock

```typescript
import { setupXrmMock, teardownXrmMock } from '@xrmforge/testing';

beforeEach(() => setupXrmMock());
afterEach(() => teardownXrmMock());

// With WebApi overrides:
setupXrmMock({
  webApiOverrides: {
    retrieveMultipleRecords: async () => ({ entities: [{ name: 'Test' }] }),
  },
});
```

Sets up a global `Xrm` object on `globalThis` with minimal WebApi, Navigation, and Utility stubs.
