# @xrmforge/helpers

## 0.17.0

### Minor Changes

- c9277bb: Web API response readers accept an entity-cast response directly (OE-21)

  `parseLookup`, `parseLookups`, `parseFormattedValue`, `expanded` and `expandedMany`
  now take a `WebApiRecord` (`object & { length?: never }`) instead of
  `Record<string, unknown>`. A response cast to a generated Entity interface can be
  passed straight in - no separate `as Record<string, unknown>` cast and no leaving
  it as `any` (which silently dropped type safety on every field). A whole result
  collection passed by mistake (a forgotten `[0]`) is still rejected at compile time.
  Backward compatible: `Record<string, unknown>` and `any` still work.

## 0.15.0

### Minor Changes

- Add `typedFields(formContext, kindMap)` for genuinely cross-entity / cross-form scripts where no single
  generated `FormTypeInfo` fits (OE-16, Option B). It is the typed, NULLABLE counterpart to `typedForm`: the
  kindMap (a `Record<fieldLogicalName, AttrKind>`) drives per-field types, every accessor is nullable (a field
  may be absent on the current record - honest, unlike a per-entity union's false non-null), and the same
  auto-submit wrapping plus `controls`/`$context`/`$unsafe` as `typedForm` apply. Pass the generated
  `XxxFieldKinds` constant (one entity across several forms) or a hand-written map of named constants (a bespoke
  cross-entity group). Replaces the hand-built `form-access.ts` getValue/setValue wrapper layer that showcases
  otherwise reinvent (Rule 19). New exports: `typedFields`, `TypedFields`, `AttrKind`, `KindMap`,
  `KindToAttribute`. The `typedForm` runtime proxy is factored into a shared internal helper; no `typedForm`
  behaviour change (its set-trap message is now generic).

### Patch Changes

- The type-level tests (`tests/*.test-d.ts`) are now gated: `typecheck` runs a second `tsc` pass over them (new
  `tsconfig.test-d.json`). Repaired `typed-form-inference.test-d.ts`, which had silently stopped compiling (it
  used the bare form-interface shape whose `ExtractFields` resolves to `never` across the package boundary; it
  now uses the `FormTypeInfo` shape typegen actually emits).

## 0.14.0

### Minor Changes

- Add `clearAppNotification(id)` (Runde 10 FW-4): the additive, non-breaking counterpart to
  `addAppNotification` (which already returns the id). Removes a persistent status banner explicitly
  (polling, long-running cloud flows); together with `autoHideMs` it covers all three banner lifecycles
  (auto-hide / manual-clear / fire-and-forget). Encapsulates the defensive `Xrm.App` access once - `Xrm.App`
  is typed non-optional but can be `undefined` at runtime (mobile, older UCI), so callers no longer cast.
- Add `parentXrm()` and `getWebResourceContext()` (Runde 10 F-LMA10-03): browser-safe helpers for embedded
  HTML WebResources. `parentXrm()` returns the host form API reached via `window.parent.Xrm` (a WebResource in
  a form IFrame gets no `executionContext`); `getWebResourceContext()` returns the hosting record
  `{ entityId, entityName }` from the parent page context (brace-stripped id). Both encapsulate a cast that
  @types/xrm does not type tightly enough, so WebResource code stays cast-free.

## 0.13.1

### Patch Changes

- Clarify the `expanded<T>()` JSDoc: it returns `null` only when the nav property is absent, `null`, or an
  array - a present object (even `{}`) is returned as-is. The previous "absent/empty" wording was misleading
  (an empty object is NOT mapped to `null`; this is the documented contract, asserted by a unit test).
  Doc/`.d.ts` only, no behaviour change (R46-06).

## 0.13.0

### Minor Changes

- Add `expanded<T>()` and `expandedMany<T>()` (F-MK9-08): read a single-valued or collection-valued
  `$expand`ed navigation property from a Web API response as a typed `Partial<T>` / `Partial<T>[]`. Parametrize
  with the generated Entity interface (`expanded<Contact>(account, nav)`). `Partial<T>` is deliberate and
  honest - a partial `$select` inside the `$expand` only returns the selected fields. Replaces the untyped
  hand-cast `entity['nav'] as { ... }`, the largest remaining untyped path in form scripts. `expanded` returns
  `null` for an absent/empty/array value; `expandedMany` returns `[]` for an absent/non-array value.

## 0.12.0

### Minor Changes

- `addAppNotification` gains an `autoHideMs` option: the banner clears itself after the given delay
  (fire-and-forget `setTimeout` + `Xrm.App.clearGlobalNotification`), so callers no longer hand-build a
  transient-notification helper (Runde 9 F-MK9-10).

## 0.11.0

### Minor Changes

- Add `setAndSubmit(attr, value)`: on-form set + `SubmitMode.Always` in one type-safe call (the dominant programmatic-set idiom). Explicit opt-in, does not change `setValue` semantics (Runde 8 F-LMA8-N1).
- Add `formLookupIdUnsafe(form, nav)` / `formLookupUnsafe(form, nav)`: read an off-form lookup via the `$unsafe` proxy, bundling the `LookupAttribute` cast + null check (Runde 8 F-LMA8-N2).
- Add `isUnsavedRecord(formContext)`: treats both empty-string and null-GUID ids as unsaved (Runde 8 F-MK8-N4b).
- Add `getEnvironmentVariable(schemaName)` + `clearEnvironmentVariableCache()`: cached Dataverse environment-variable reader (current value, default fallback, OData-escaped; WebApi errors propagate) (Runde 8 F-MK8-N4a).

## 0.10.1

### Patch Changes

- Add package README (rendered on npmjs.com). Docs only, no code change.

## 0.10.0

### Minor Changes

- New consumer helpers that showcase sessions previously hand-rolled per form (F-MAR7-03,
  F-LMA7-07/09):
  - `parseMultiSelect(value, emptyAsNull?)`: normalize a MultiSelect OptionSet (Web API
    comma-string, number[], single number, null) to `number[]` (or `null` with `emptyAsNull`).
    Empty/whitespace parts are dropped before Number() to avoid a spurious 0 from a trailing comma.
  - `clearAndSubmit(attr)`: clear an attribute and force `SubmitMode.Always` without the
    `setAndSubmit(attr, null)` type-inference trap (F-LMA7-09).
  - `setUnsafeAndSubmit(form, field, value)`: set an off-form (`$unsafe`) attribute and force submit;
    returns false if the field is absent (F-LMA7-07).
  - `addAppNotification(message, level, options?)` + `AppNotificationLevel` const enum: wrap
    `Xrm.App.addGlobalNotification`, applying the `XrmEnum.AppNotificationLevel` runtime-gap cast at a
    single boundary instead of at every call site.

## 0.9.0

### Minor Changes

- Custom API action executors now return `void` for a void action (no typed result) instead of
  `Response`. `createBoundAction`/`createUnboundAction` (and their with-params variants) without a
  `TResult` type argument resolve to `Promise<void>`; `execute()` already throws on a non-2xx
  response and parses JSON itself. Previously the void case was typed `Promise<Response>` but at
  runtime returned `response.json()` (status 200) or the raw `Response` (204), so following the type
  with `if (!result.ok)` crashed at runtime with `response.json is not a function` (F-MAR7-01).
  Functions (`createBoundFunction`/`createUnboundFunction`) always carry a result and are unchanged.
  Type-level breaking change for callers that consumed the (unusable) `Response` return value.

## 0.8.0

### Minor Changes

- New `isFormType(formContext, FormType)`: form-type equality without the TS2367 friction.
  `formContext.ui.getFormType()` is typed as `XrmEnum.FormType` (from @types/xrm), which is a
  nominally distinct type from the `FormType` const enum here, so a bare
  `getFormType() === FormType.Create` fails to compile under `strict` ("no overlap"). `isFormType`
  bridges both numeric enums for the equality case (K32-03).
- `withProgress` no longer shows its own error dialog on failure. It shows/closes the progress
  indicator and re-throws, leaving the single error UI to the handler wrapper
  (`wrapHandler`/`wrapCommand`). Previously it opened an error dialog AND the wrapper showed a form
  notification, producing a duplicate error UI when `withProgress` ran inside a wrapped command
  (the common ribbon case) (K32-06). Behavior change.

## 0.7.0

### Minor Changes

- New `callCloudFlow<TReq, TRes>(triggerUrl, body?, options?)`: a browser-safe, typed wrapper for
  calling a Power Automate cloud flow via its HTTP request trigger URL. Sends the body as JSON,
  returns parsed JSON / raw text / `undefined` (204), and throws on a non-2xx status (with the status
  and response body in the message). Covers the direct HTTP-trigger case (Custom API / proxied calls
  stay with `createUnboundAction`). The trigger URL is passed in as a parameter (it carries a SAS
  signature; never hard-code it). Compose with `withProgress` for a spinner. Zero Node dependencies.

## 0.6.3

### Patch Changes

- typed-form.ts: both `@example` blocks use `typedForm<...FormTypeInfo>` instead of the bare form
  interface (the second block had mislabeled the bare interface as "Recommended"; the bare form
  resolves to `never` across package boundaries in TS 5.9+; F28-01).

## 0.6.2

### Patch Changes

- typed-form.ts: JSDoc republish - `$control` -> `controls` proxy (the published 0.6.1 tarball still
  carried the pre-fix JSDoc); test comment/name `$context and $control` -> `$context and controls`
  (K25-03 remnant).

## 0.6.1

### Patch Changes

- helpers: FormType const enum (XrmEnum.FormType does NOT exist at runtime with esbuild)
  devkit: AGENT.md NEVER XrmEnum.FormType

## 0.6.0

### Minor Changes

- helpers: typedForm auto-calls setSubmitMode('always') on every setValue (prevents AutoSave data loss)
  typegen: PrimaryId non-nullable in generated Entity interfaces (string instead of string | null)

## 0.5.0

### Minor Changes

- helpers: form.controls.fieldname proxy for typed control access (replaces $control)
  devkit: AGENT.md addOnChange contradiction fixed, controls proxy documented, no control casts

## 0.4.3

### Patch Changes

- helpers: Non-nullable fields (revert), typed $control from ControlMap, $control(string) overload
  devkit: AGENT.md parseLookup Before/After, NEVER manual OData annotations

## 0.4.2

### Patch Changes

- Fix: duck typing for FormTypeInfo extraction (replaces fragile structural matching)

## 0.4.1

### Patch Changes

- Fix FormTypeInfoProtocol: form property changed from Xrm.FormContext to object
  (generated interfaces use Omit<FormContext> which is not assignable to FormContext)

## 0.4.0

### Minor Changes

- Fix typedForm TS 5.9.3 compatibility via FormTypeInfo pattern.
  typegen generates FormTypeInfo interface per form. typedForm uses it for
  reliable type extraction across package boundaries. New: $unsafe() for
  off-form fields, normalizeGuid() for getId()/WebApi GUIDs.

## 0.3.0

### Minor Changes

- typedForm() with full single-parameter type inference, AGENT.md overhaul, stricter quality gate

  helpers:
  - typedForm<MyForm>(fc) now correctly infers field types from generated form interfaces
  - ExtractFields/ExtractAttributeMap/ExtractControlMap conditional types
  - No `as any` needed, full IDE autocomplete

  devkit:
  - AGENT.md: typedForm as primary pattern, entity-level Fields in select(), OptionSet Enums in FetchXML, named constants, pickLang(), Custom API Executors
  - validate-form.mjs: 15 checks (up from 6), catches raw strings in helpers/select/FetchXML
  - example-form.ts: demonstrates typedForm pattern

## 0.2.0

### Minor Changes

- Framework improvements from Round 5 analysis:
  - typegen: Always include statuscode/statecode in form Fields enum (system fields without FormXml control)
  - helpers: select() now accepts both variadic args and a single array
  - devkit: example-form.ts template rewritten with best practices (wrapHandler, Logger, Fields Enum, FormNotificationLevel)
  - devkit: validate-form.mjs quality gate script added to scaffold templates
