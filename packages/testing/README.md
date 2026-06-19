# @xrmforge/testing

[![npm version](https://img.shields.io/npm/v/@xrmforge/testing.svg)](https://www.npmjs.com/package/@xrmforge/testing)
[![license](https://img.shields.io/npm/l/@xrmforge/testing.svg)](https://github.com/juergenbeck/XrmForge/blob/main/LICENSE)

**Type-safe testing utilities for Dynamics 365 form scripts.** Builds mock `FormContext` objects from your generated form interfaces, with compile-time field validation -- no more `as any`, no more hand-wired `XrmMockGenerator` setup.

> Part of [XrmForge](https://github.com/juergenbeck/XrmForge#readme). Works with any test runner; examples use [Vitest](https://vitest.dev).

---

## Installation

```bash
npm install --save-dev @xrmforge/testing
```

**Requirements:** `@types/xrm` (>= 9.0.0) as a peer dependency.

---

## `createFormMock`: a typed mock FormContext

Pass your generated form interface as the type parameter. The initial values are validated against the form's fields at compile time, so a typo or a wrong value type is a build error, not a silent test pass.

```typescript
import { describe, it, expect } from 'vitest';
import { createFormMock } from '@xrmforge/testing';
import type { AccountMainForm, AccountMainFormMockValues as MockValues } from '../../generated/forms/account.js';
import { onLoad } from '../../src/forms/account-form.js';

describe('Account onLoad', () => {
  it('locks the MPK field when set', () => {
    const mock = createFormMock<AccountMainForm>({
      markant_ismpk: 1,         // compile error if the field or type is wrong
    } satisfies MockValues);

    onLoad(mock.asEventContext());

    expect(mock.getControl('markant_ismpk').getDisabled()).toBe(true);
  });
});
```

`createFormMock(values, options?)` accepts:

- `values` -- field values as a plain object (lazily creates absent fields as `null`).
- `options.entityName` / `options.entityId` -- seed the entity (default: `'unknown'` / null GUID).
- `options.formType` -- the value returned by `ui.getFormType()` (default `2` = Update; set `1` to test create-only paths).
- `options.tabs` -- seed a tab/section structure so `ui.tabs.get()`, `forEach`, and section visibility become testable.

---

## The FormMock API

The returned `FormMock<TForm>` gives you the typed context plus test-friendly accessors:

| Member | Purpose |
|--------|---------|
| `formContext` | The mock `FormContext`, typed as your form interface. |
| `getValue(name)` / `setValue(name, v)` | Shorthand for `getAttribute(name).getValue()/.setValue()`. |
| `getAttribute(name)` | The underlying `MockAttribute` for detailed assertions. |
| `getControl(name)` | The underlying `MockControl` (visibility, disabled, etc.). |
| `ui` | The `MockUi` for form-notification assertions. |
| `asEventContext()` | An `Xrm.Events.EventContext` for `onLoad` handlers. |
| `asAttributeEventContext(field)` | An event context with the field as event source (for `onChange`). |
| `fireOnChange(field)` | Fire all registered `onChange` handlers for a field. |
| `fireOnSave(saveMode?)` | Fire `onSave` handlers; returns `true` if a handler called `preventDefault()`. |

### Testing onChange and onSave

```typescript
const mock = createFormMock<ContactMainForm>({ statuscode: 1 });

mock.getAttribute('statuscode').setValue(2);
mock.fireOnChange('statuscode');          // runs your registered onChange logic

const cancelled = mock.fireOnSave(70);    // 70 = AutoSave
expect(cancelled).toBe(false);
```

---

## `setupXrmMock`: a global Xrm for free-standing code

When your code calls `Xrm.WebApi`, `Xrm.Navigation`, `Xrm.Utility`, or `Xrm.App` outside a form context, install a minimal global `Xrm`:

```typescript
import { beforeEach, afterEach } from 'vitest';
import { setupXrmMock, teardownXrmMock } from '@xrmforge/testing';

beforeEach(() => setupXrmMock());
afterEach(() => teardownXrmMock());
```

Override only the methods a test needs; everything else returns a safe default:

```typescript
setupXrmMock({
  webApiOverrides: {
    retrieveMultipleRecords: async () => ({ entities: [{ name: 'Test' }] }),
  },
  globalContextOverrides: { languageId: 1031, userName: 'Test User' },
});
```

Override groups: `webApiOverrides`, `navigationOverrides`, `utilityOverrides`, and `globalContextOverrides` (client URL, language, user, security roles). Methods are plain functions, not spies -- wrap them in `vi.fn()` yourself if you need call assertions.

---

## Exports

`createFormMock`, `setupXrmMock`, `teardownXrmMock`, the mock classes `MockAttribute`, `MockControl`, `MockEntity`, `MockUi`, `MockEventContext`, and the types `FormMock`, `CreateFormMockOptions`, `MockTabConfig`, `MockSectionConfig`, `FormNotification`, `SetupXrmMockOptions`.

## Documentation

Full guide: [XrmForge on GitHub](https://github.com/juergenbeck/XrmForge#readme).

## License

[MIT](https://github.com/juergenbeck/XrmForge/blob/main/LICENSE) (c) XrmForge Contributors.
