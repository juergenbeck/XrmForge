# @xrmforge/helpers

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
