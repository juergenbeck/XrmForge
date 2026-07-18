# @xrmforge/devkit

## 0.7.41

### Patch Changes

- Scaffold `eslint.config.js` now also ignores `legacy-reference/**`, so `pnpm lint` (`eslint .`) stays green on migration-reference code that is intentionally left unconverted. This keeps the lint gate aligned with validate-form (`eslint src/`). Fixes the A71-03/F-MK13-01 regression where the ignore lived only in the generated showcase config and was lost on reset.

## 0.7.40

### Patch Changes

- 45f4df4: Scaffold a `wrapEnableRule` helper in `src/shared/error-handler.ts` for ribbon Enable Rules. Unlike a command, an Enable Rule is evaluated synchronously by the ribbon on every refresh and its return value decides button visibility/enablement, so the wrapper is synchronous and returns a real `boolean`. An `async` rule returns a Promise, which the ribbon always treats as truthy (the button is then permanently shown - a subtle, common legacy bug). `wrapEnableRule` fails closed (returns `false` on error) and only logs, never surfacing a form/app banner (a rule that runs on every refresh must not spam one). The quality-gate template (`validate-form.mjs` `HANDLER_WRAPPERS`) and the AGENT.md instructions accept it as the fifth error-handling wrapper.

## 0.7.38

### Patch Changes

- `AGENT.md` (template / doc only, no devkit source change): document `typedFields` (OE-16) as the typed,
  nullable way to do cross-entity / cross-form field access - via the generated `XxxFieldKinds` constant or a
  hand-written map of named constants - and call out that hand-building a `form-access.ts` getValue/setValue
  wrapper layer is the Rule-19 anti-pattern `typedFields` replaces. The raw `Xrm.FormContext` + named constants
  pattern stays supported as the no-kindMap fallback. Also bump the scaffold `@xrmforge/helpers` pin to
  `^0.15.0` so a fresh `init` can use `typedFields`.

## 0.7.37

### Patch Changes

- Template fixes from showcase round 11 (template / scaffold only, no devkit source change):
  - `scaffold.ts`: bump the scaffold pins to `@xrmforge/cli@^0.9.0` and `@xrmforge/testing@^0.8.0` (were `^0.8.0`
    / `^0.7.0`). Without this a fresh `init` pulls an older cli (and transitively typegen 0.14.2, no XxxExpands),
    and the testing pin lagged the 0.8.0 publish (F-MK11-01).
  - `AGENT.md`: a polymorphic `@odata.bind` (write) needs the target-qualified `XxxExpands` value, not the blank
    LogicalName, same as `$expand` (4 spots: enum table, prose, two NEVER rules; F-MK11-02, MS-Learn-verified).
  - `validate-form.mjs`: Check 3n FetchXML `attribute=` regex now matches double-quote too (`["']`), with a
    `[a-z]` interpolation guard so `attribute="${Fields.X}"` is not flagged (validate-form 3n).

## 0.7.36

### Patch Changes

- AGENT.md template: fix the polymorphic-lookup `$expand` documentation (R46-02 doc bug: `ownerid` /
  `regardingobjectid` do NOT follow the `<lookup>_<target>` scheme) and switch it to the generated `XxxExpands`
  enum (section 6, the 5b table, output list and NEVER list). Template / doc only, propagated with typegen 0.15.0
  (F-MK9-08-Sub).

## 0.7.35

### Patch Changes

- Make HTML WebResources first-class in the scaffold (Runde 10, OE-14). Template/scaffold only:
  - `error-handler.ts`: add `wrapWebResource(name, logger, init, { errorTarget? })` - wraps a WebResource
    `init` entry point, surfacing errors in a local DOM element (default `#error`/`#message`/`document.body`),
    not an app banner.
  - `validate-form.mjs`: Check 3l now accepts `wrapHandler|wrapCommand|wrapGridCommand|wrapWebResource` from a
    single shared list, fixing the false positives on `wrapGridCommand` (FW-3) and on a wrapped WebResource
    `init` (F-LMA10-02).
  - `package.json` scripts: add `lint` (`eslint . --max-warnings=0`) and rename `validate` -> `validate:form`
    (FW-1). Add `happy-dom` (^16, the newest Node-18-compatible major) as a test devDependency for WebResource
    DOM tests (F-LMA10-07). Bump scaffold pins to `@xrmforge/helpers@^0.14.0` and `@xrmforge/testing@^0.7.0`.
  - `AGENT.md`: document `parseFormattedValue` (the one allowed place for non-lookup display labels, F-LMA10-01),
    `parentXrm()`/`getWebResourceContext()`, `wrapWebResource`, the per-test happy-dom pragma, `clearAppNotification`
    - the `Xrm.App` optional-at-runtime pitfall (FW-4), the SchemaName-casing "read, do not guess" rule (FW-6),
      and that Workflow/System actions have no generated executor (FW-7, with a hand-built `createBoundAction` example).

## 0.7.34

### Patch Changes

- AGENT.md template: document that polymorphic lookups (`customerid`/`ownerid`/`regardingobjectid`) need a
  target-qualified `$expand` name (`customerid_account`), not the blank `XxxNavigationProperties` value
  (R46-02). Add an "HTML WebResources" section describing the TypeScript-logic + HTML-shell split, the
  `window.parent.Xrm` access pattern and legacy-modernization guidance. Template only.

## 0.7.33

### Patch Changes

- Scaffold pins `@xrmforge/helpers` at `^0.13.0` so fresh projects get `expanded<T>()`/`expandedMany<T>()`
  (F-MK9-08). AGENT.md template documents reading `$expand` results via `expanded<T>()`/`expandedMany<T>()`
  instead of hand-casting nested objects. Template/pin only.

## 0.7.32

### Patch Changes

- AGENT.md scaffold template: document that `XxxFields`/`XxxNavigationProperties`/`XxxFormFieldsEnum` members
  are named after the attribute SchemaName (the cased logical name, e.g. `statecode` -> `StateCode`), not the
  display label, and are therefore guessable from the logical name (typegen 0.14.0, F-MK9-05/07). Updated the
  affected example member casings accordingly (`WebsiteUrl` -> `WebSiteURL`, `Statecode` -> `StateCode`,
  `Statuscode` -> `StatusCode`, `Fullname` -> `FullName`). Template/docs only.

## 0.7.31

### Patch Changes

- Scaffold pins `@xrmforge/helpers` at `^0.12.0` (self-clearing app notifications via
  `addAppNotification(..., { autoHideMs })`, Runde 9 F-MK9-10). AGENT.md template lists the auto-hide
  option among the helpers a project must not hand-build.

## 0.7.30

### Patch Changes

- `error-handler.ts` scaffold template: `wrapCommand` is now generic
  (`wrapCommand<TArgs extends unknown[] = []>`) so ribbon command handlers can declare extra command
  parameters type-safely instead of the old `...args: never[]`. Added
  `wrapGridCommand<TArgs extends unknown[] = [string[]]>` for commands registered on a subgrid, where the
  PrimaryControl may be a `GridControl` (which has no form `ui`); its error surface is an app-level banner
  (`addAppNotification`) instead of a form notification, so grid command failures are no longer silently
  swallowed (F-MK9-02). AGENT.md template documents both wrappers. Affects newly scaffolded projects only;
  existing `src/shared/error-handler.ts` files are untouched.

## 0.7.29

### Patch Changes

- Scaffold pins `@xrmforge/testing` at `^0.6.0` (subgrid `MockControl.refresh()`, Runde 9 F-MK9-01).
- AGENT.md template: corrected the `XxxNavigationProperties` import path in the Lookup examples from
  `generated/entities/<entity>.js` to `generated/fields/<entity>.js` (typegen emits NavigationProperties
  into `fields/`, not `entities/`; Runde 9 F-MK9-04). Added five @types/xrm pitfalls (#11-#15:
  WebResourceControl, Xrm.WebApi PromiseLike vs Promise, PageInputHtmlWebResource, FormNotificationLevel.Info,
  StandardControl.setDisabled/setVisible).

## 0.7.28

### Patch Changes

- AGENT.md template: replace the "per-entity union FormTypeInfo (planned)" note with a clear statement that raw `Xrm.FormContext` + named constants is the deliberate, supported pattern for both cross-entity and single-entity-multi-form scripts. The union type was considered and rejected because it would type fields the active form may lack as non-nullable, the false compile-time safety the framework avoids (OE-13, decided Option 0).

## 0.7.27

### Patch Changes

- AGENT.md template: document the cross-entity / cross-form script pattern (raw `Xrm.FormContext` + named constants with blank logical names) as an accepted exception to typedForm (F-R8-N3a), and clarify that whole-section show/hide uses `.sections.get(name).setVisible()` rather than per-control toggling (F-R8-N3b / F-LMA7-10).

## 0.7.26

### Patch Changes

- Scaffold pins: bump `@xrmforge/helpers` to `^0.11.0` and `@xrmforge/testing` to `^0.5.0` so fresh `xrmforge init` projects get the Runde-8 helpers/mocks (a 0.x caret never crosses a minor boundary).
- AGENT.md template: document the new helpers (`setAndSubmit`, `formLookupIdUnsafe`, `getEnvironmentVariable`, `isUnsavedRecord`), the `getAttribute`/`getControl` lookup-name rule (entity `Fields` is `_value`-form, use the blank form-level enum / NavigationProperties; F-MK8-05), and the `getControl(string-variable)` pitfall (F-R8-N5).

## 0.7.25

### Patch Changes

- Add package README (rendered on npmjs.com). Docs only, no code change.

## 0.7.24

### Patch Changes

- AGENT.md template: new @types/xrm pitfall (#9) on `Xrm.LookupValue.name` (typed `string | undefined`):
  coalesce it with `?? ''` before passing it to a string setter; the parseLookup/formLookup helpers
  already return `''` (F-LMA7-11).

## 0.7.23

### Patch Changes

- AGENT.md template documents the new @xrmforge/helpers 0.10.0 helpers (parseMultiSelect,
  clearAndSubmit, setUnsafeAndSubmit, addAppNotification/AppNotificationLevel) with NEVER entries
  against hand-rolled equivalents, plus an `@odata.bind` guidance note (resolve the EntitySet plural
  via getEntityMetadata; deliberately no helper) (F-MAR7-03, F-LMA7-07/09).
- Scaffold devDependency pin `@xrmforge/helpers ^0.9.0` -> `^0.10.0` so freshly scaffolded projects
  get the new helpers (a 0.x caret never crosses a minor).

## 0.7.22

### Patch Changes

- AGENT.md template: the `generated/index.ts` description now states that only entities and forms are
  re-exported via `export *`, while OptionSets, Fields/NavigationProperties and Actions are imported
  directly from their files (name-collision-safe), matching the typegen 0.12.2 barrel (F-LMA7-01).

## 0.7.21

### Patch Changes

- AGENT.md template: testing section documents the @xrmforge/testing 0.4.0 complex-form mock
  helpers (createFormMock formType option, attribute setText/setPrecision, entity addOnSave +
  fireOnSave, setupXrmMock roles ItemCollection + utilityOverrides) (F-MAR7-02).
- Scaffold devDependency pin `@xrmforge/testing ^0.3.0` -> `^0.4.0` so freshly scaffolded projects
  get the complex-form mock helpers (a 0.x caret never crosses a minor).

## 0.7.20

### Patch Changes

- AGENT.md template: Custom API executor section (8) now states that `execute()` throws on failure
  itself (never check `.ok`/`.status` or call `.json()` on the result) and shows the void
  fire-and-forget case (`await Action.execute(...)`) next to the typed-result case. Matching NEVER
  entry, subagent-handoff note, and a corrected "Custom API Call" before/after example (F-MAR7-01).
- Scaffold devDependency pin `@xrmforge/helpers ^0.8.0` -> `^0.9.0` so freshly scaffolded projects
  get the void-executor return type (a 0.x caret never crosses a minor, so the old pin would keep new
  projects on 0.8.x without the fix).

## 0.7.19

### Patch Changes

- AGENT.md + validate-form.mjs scaffold templates: lookup convention (F-LMA7-05). New AGENT.md
  section 5b documents that the `XxxFields` lookup enum is already `_value`-form (use directly in
  `$select`/`$filter`) while `XxxNavigationProperties` is blank (use for `parseLookup`/`$expand`/
  `@odata.bind`); double-wrapping `` `_${XxxFields.X}_value` `` or passing a Fields value to
  `parseLookup` compiles green but breaks at runtime (OData 400 / always `null`). The NEVER block and
  the Legacy-to-XrmForge table got matching entries.
- validate-form.mjs gains two pattern checks for this "green-but-broken" bug class that no tsc/eslint
  gate sees: a hand-built `_${...}_value` key, and `parseLookup(x, XxxFields.Y)`. Verified
  false-positive-free against the markant + lmapp showcases.

## 0.7.18

### Patch Changes

- Scaffold uses `generated/` instead of `typings/` for generated types. The `xrmforge generate`
  default output (`./generated`), the `.gitattributes` LF pin, the AGENT.md import examples and the
  example-form TODO already used `generated/`; only the created directory and the tsconfig `include`
  lagged on `typings/`, so a freshly scaffolded project type-checked an empty `typings/` while the
  real types landed unchecked in `generated/`. tsconfig `include` is now `src/**/*.ts` +
  `generated/**/*.ts` (K32-04).
- AGENT.md template: the form-type guard uses `isFormType(form.$context, FormType.Create)` instead
  of `getFormType() === FormType.Create`, which raises TS2367 under `strict` (K32-03).
- Scaffold devDependency pins: `@xrmforge/helpers ^0.8.0` (isFormType) and `@xrmforge/testing ^0.3.0`
  (createFormMock tabs option).
- AGENT.md template "@types/xrm Pitfalls" list extended with two gaps hit in the Runde-6 showcase:
  `GridControl.setFilterXml` is missing (cast the control), and `Xrm.App` global-notification `level`
  is an `XrmEnum` (not available at runtime; pass the numeric value).

## 0.7.17

### Patch Changes

- AGENT.md scaffold template: document `callCloudFlow` (helpers 0.7.0) as the canonical way to call
  a Power Automate cloud flow (HTTP-request trigger) from a form script. Adds a "Cloud Flow Call"
  before/after example, a NEVER rule against hand-rolled `fetch`/`XMLHttpRequest` for flow calls, a
  legacy-pattern table row, the helpers package blurb, and subagent-handoff item 16. Template-only;
  closes the agent-facing gap from Backlog C (K32-01).

## 0.7.16

### Patch Changes

- scaffold.ts: `@xrmforge/helpers` dependency pin `^0.6.1` -> `^0.7.0` so fresh `init` projects get
  the current helpers minor (which adds `callCloudFlow`); a 0.x caret never crosses the 0.6/0.7
  boundary, so the old pin would install 0.6.x (K26-01 class).

## 0.7.15

### Patch Changes

- Scaffold `.gitignore` now ignores `.env` / `.env.local`. `xrmforge generate` (cli >= 0.8.0) can
  write entered credentials to a local `./.env`, so fresh projects must never track it.
- scaffold.ts: `@xrmforge/cli` dependency pin `^0.7.0` -> `^0.8.0` (the `.env` auto-load and
  interactive credential prompt land in cli 0.8.0; a 0.x caret never crosses the minor boundary).

## 0.7.14

### Patch Changes

- Scaffold CI templates (github-actions-ci.yml, azure-pipelines.yml): drop the
  `--url` / `--tenant-id` / `--client-id` / `--client-secret` flags. `xrmforge generate
--auth client-credentials` now reads the `XRMFORGE_*` env block directly, so the secret never
  appears as a command-line argument (kept out of the runner's process list). Requires cli >= 0.7.0.
- scaffold.ts: `@xrmforge/cli` dependency pin `^0.6.0` -> `^0.7.0` (the env-var CI template needs
  the cli env-reading feature; a 0.x caret never crosses the 0.6/0.7 minor boundary, so fresh
  `init` projects would otherwise pull a cli without env reads; K26-01 class).

## 0.7.13

### Patch Changes

- Gate consolidation: scaffold no longer emits `scripts/self-check.sh`; `validate-form.mjs`
  is the single quality gate (3 checks ported from self-check.sh: var declarations,
  XMLHttpRequest, test-completeness warning). Scaffold file count 18 -> 17.
- AGENT.md: use `typedForm<...FormTypeInfo>` throughout instead of the fragile bare
  `typedForm<FormInterface>` (resolves to `never` across package boundaries in TS 5.9+; F28-01).
- example-form.ts template: import/usage TODO uses `typedForm<ExampleFormTypeInfo>` (K29-01).
- CI templates (github-actions-ci.yml, azure-pipelines.yml): run `npm run validate`
  (tsc + eslint + pattern checks) instead of bare `tsc --noEmit`.

## 0.7.12

### Patch Changes

- scaffold.ts: `@xrmforge/cli` dependency pin `^0.5.0` -> `^0.6.0` (a 0.x caret never crosses
  the 0.5/0.6 minor boundary, so fresh `init` projects pulled stale cli; K26-01).
- example-form.ts template: header comment `$control` -> `controls` proxy (K25-03 remnant).

## 0.7.11

### Patch Changes

- Scaffold CI templates (github-actions-ci.yml, azure-pipelines.yml): replaced the
  non-existent `xrmforge generate --from-config` with explicit auth flags fed from repo
  secrets (K25-01).
- self-check.sh: flag `as Xrm.FormContext` instead of demanding a FormContext cast, consistent
  with validate-form.mjs (the typedForm primary path needs no cast; K25-02).
- scaffold.ts: `@xrmforge/eslint-plugin` pin `^0.2.1` -> `^0.3.0`.
- AGENT.md: corrected `withProgress` signature to `withProgress(message, () => op)` plus
  pickLang (K24-01); scaffold test template uses `createFormMock` (K23-02).

## 0.7.10

### Patch Changes

- scaffold.ts: `xrmforge init` emits `.gitattributes` (`generated/** eol=lf` plus
  `*.ts`/`*.mjs`/`*.json` eol=lf) so `generate --check` is not fooled by CRLF line endings on
  Windows (F23-LMA-01). Scaffold file count 17 -> 18.

## 0.7.9

### Patch Changes

- AGENT.md template: drift-check section for `xrmforge generate --check` (OE-11 release 2).

## 0.7.8

### Patch Changes

- Not published to npm (git-only interim, commit 313e6e6; folded into 0.7.9 at publish time).
- Scaffold templates: removed unused imports (fresh scaffolds no longer start with lint errors)
  and pulled stale version pins up to current minors (a 0.x caret would not resolve
  `helpers ^0.3.0` to 0.6.x; K21-01).

## 0.7.7

### Patch Changes

- helpers: FormType const enum (XrmEnum.FormType does NOT exist at runtime with esbuild)
  devkit: AGENT.md NEVER XrmEnum.FormType

## 0.7.6

### Patch Changes

- helpers: form.controls.fieldname proxy for typed control access (replaces $control)
  devkit: AGENT.md addOnChange contradiction fixed, controls proxy documented, no control casts

## 0.7.5

### Patch Changes

- helpers: Non-nullable fields (revert), typed $control from ControlMap, $control(string) overload
  devkit: AGENT.md parseLookup Before/After, NEVER manual OData annotations

## 0.7.4

### Patch Changes

- validate-form.mjs: 17 checks (new: FormContext cast detection, raw $filter field names)

## 0.7.3

### Patch Changes

- validate-form.mjs: recognize wrapCommand and re-exports (eliminates 39 false positives)
  AGENT.md: typed repetition beats untyped loops (8 typed lines > 1 loop with raw strings)

## 0.7.2

### Patch Changes

- AGENT.md: quality philosophy preamble (code reads like business logic, not API mechanics)

## 0.7.1

### Patch Changes

- AGENT.md: legacy helper function mapping table (25 functions mapped to XrmForge replacements)

## 0.7.0

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

## 0.6.1

### Patch Changes

- Quality fixes: eliminate raw string literals, add catch type annotations
  - testing: semantic constants for Xrm enum defaults (isolatedModules compatible)
  - webapi: catch (error: unknown) on all CRUD methods
  - cli: catch (error: unknown) on all command handlers
  - devkit: FormNotificationLevel.Error in error-handler.ts template
  - typegen: catch (err: unknown) in file-writer

## 0.6.0

### Minor Changes

- Framework improvements from Round 5 analysis:
  - typegen: Always include statuscode/statecode in form Fields enum (system fields without FormXml control)
  - helpers: select() now accepts both variadic args and a single array
  - devkit: example-form.ts template rewritten with best practices (wrapHandler, Logger, Fields Enum, FormNotificationLevel)
  - devkit: validate-form.mjs quality gate script added to scaffold templates
