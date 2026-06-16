# @xrmforge/helpers

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
