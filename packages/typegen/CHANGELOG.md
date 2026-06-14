# @xrmforge/typegen

## 0.12.0

### Minor Changes

- Quick Create forms: typegen now generates interfaces, Fields enums and typedForm support for
  Quick Create forms (systemform type=7), filtered to active forms only (`formactivationstate eq 1`,
  applied to all form types so inactive Main forms also drop out). Quick Create interfaces get a
  `QuickCreate` suffix (`AccountQuickCreateForm`). `getMainForms` -> `getForms` (Main + active QC in
  one query). Data-driven, no opt-in flag (Backlog B).

## 0.11.1

### Patch Changes

- file-writer.ts: `normalizeLineEndings()` so `generate --check` compares LF-normalized and is no
  longer fooled by CRLF working copies on Windows (F23-LMA-01).

## 0.11.0

### Minor Changes

- `xrmforge generate --check`: full in-memory generation run, byte-compare against `generated/` with
  zero writes, tri-state exit codes (0 = up to date, 1 = error, 2 = drift) and a categorized report
  (changed / missing / orphaned) per category (Entities, Fields, Forms, OptionSets, Actions). New
  API: `GenerateConfig.checkOnly`, `GenerationResult.checkResult` (OE-11 release 2).
- Includes the deterministic `getCustomApis()` sorting from 0.10.2.

## 0.10.2

### Patch Changes

- Not published to npm (git-only interim, commit 313e6e6; folded into 0.11.0).
- getCustomApis(): deterministic ordinal sort by uniquename for the APIs, their request parameters
  and response properties (previously server order, causing diff noise when a parameter was added).
  Determinism audit test added (OE-11 release 1).

## 0.10.1

### Patch Changes

- helpers: typedForm auto-calls setSubmitMode('always') on every setValue (prevents AutoSave data loss)
  typegen: PrimaryId non-nullable in generated Entity interfaces (string instead of string | null)

## 0.10.0

### Minor Changes

- Fix typedForm TS 5.9.3 compatibility via FormTypeInfo pattern.
  typegen generates FormTypeInfo interface per form. typedForm uses it for
  reliable type extraction across package boundaries. New: $unsafe() for
  off-form fields, normalizeGuid() for getId()/WebApi GUIDs.

## 0.9.1

### Patch Changes

- Quality fixes: eliminate raw string literals, add catch type annotations
  - testing: semantic constants for Xrm enum defaults (isolatedModules compatible)
  - webapi: catch (error: unknown) on all CRUD methods
  - cli: catch (error: unknown) on all command handlers
  - devkit: FormNotificationLevel.Error in error-handler.ts template
  - typegen: catch (err: unknown) in file-writer

## 0.9.0

### Minor Changes

- Framework improvements from Round 5 analysis:
  - typegen: Always include statuscode/statecode in form Fields enum (system fields without FormXml control)
  - helpers: select() now accepts both variadic args and a single array
  - devkit: example-form.ts template rewritten with best practices (wrapHandler, Logger, Fields Enum, FormNotificationLevel)
  - devkit: validate-form.mjs quality gate script added to scaffold templates
