# @xrmforge/testing

## 0.6.0

### Minor Changes

- `MockControl`: add `refresh()` (a no-op that counts calls, readable via `getRefreshCount()`) for subgrid
  controls. `GridControl.refresh()` is not in @types/xrm; a missing mock previously threw an unhandled
  rejection in subgrid tests that call `setFilterXml` + `refresh` (Runde 9 F-MK9-01).

## 0.5.0

### Minor Changes

- `setupXrmMock`: add `webApiOverrides.execute` / `executeMultiple`. The default `online.execute` returns a 204 (no body), which makes Custom API executors that call `response.json()` throw; tests can now inject a JSON `Response` (Runde 8 F-MK8-04b).
- `MockControl`: add OptionSet methods (`addOption`/`removeOption`/`clearOptions`/`getOptions`), lookup view methods (`addCustomView`/`getCustomViews`/`setDefaultView`/`getDefaultView`), and subgrid `setFilterXml`/`getFilterXml` (not in @types/xrm).
- `MockAttribute`: add `getOptions`/`setOptions` (OptionSet option-list seed).

## 0.4.1

### Patch Changes

- Add package README (rendered on npmjs.com). Docs only, no code change.

## 0.4.0

### Minor Changes

- Complex-form mock gaps closed (F-MAR7-02), so tests of real forms stop hand-patching the mock:
  - `createFormMock(values, { formType })` seeds the form type returned by `ui.getFormType()`
    (default 2 = Update), making Create-only paths (`isFormType(ctx, FormType.Create)`) testable.
  - `MockAttribute` gains `getText()`/`setText()` (OptionSet label) and `getPrecision()`/
    `setPrecision()` (number precision); both default to a neutral value and are test-seedable.
  - `MockEntity` gains `addOnSave`/`removeOnSave` (so onLoad scripts that register an onSave handler
    no longer throw) plus `fireOnSave()` on the FormMock to trigger them with a save event context
    (getSaveMode/preventDefault/isDefaultPrevented).
  - `setupXrmMock` exposes `userSettings.roles` as a real `Collection.ItemCollection<LookupValue>`
    (`get()`/`forEach`/`getLength`, seedable via `globalContextOverrides.roles` or derived from
    `securityRoles`; `getAll` kept for backwards compat) and adds `utilityOverrides`
    (`getEntityMetadata`, `lookupObjects`).

## 0.3.0

### Minor Changes

- `createFormMock` gains a `tabs` option (with `MockTabConfig`/`MockSectionConfig`): seed a
  tab/section structure so `ui.tabs.get()` (no argument = all tabs), `ui.tabs.forEach`, and
  cross-tab section visibility are testable. Sections track `setVisible`, so a test can assert
  visibility after onLoad. `ui.tabs.get(name)` still fabricates a stateful tab on demand
  (backwards compatible); `ui.tabs.get()` returns an array (empty when no tabs were seeded or
  fabricated) (K32-07).
- `ui.tabs.forEach` now requires a callback, matching the real Xrm collection API (the previous
  no-op stub silently accepted a missing callback).

## 0.2.4

### Patch Changes

- Quality fixes: eliminate raw string literals, add catch type annotations
  - testing: semantic constants for Xrm enum defaults (isolatedModules compatible)
  - webapi: catch (error: unknown) on all CRUD methods
  - cli: catch (error: unknown) on all command handlers
  - devkit: FormNotificationLevel.Error in error-handler.ts template
  - typegen: catch (err: unknown) in file-writer
