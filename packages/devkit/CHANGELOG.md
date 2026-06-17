# @xrmforge/devkit

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
