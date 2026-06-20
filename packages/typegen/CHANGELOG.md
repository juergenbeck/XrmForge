# @xrmforge/typegen

## 0.13.2

### Patch Changes

- Generated Custom API executors now carry a `/* @__PURE__ */` annotation before each
  `createUnboundAction`/`createBoundAction`/`createUnboundFunction`/`createBoundFunction` call. esbuild
  treats a top-level `const = call()` as potentially side-effecting unless annotated, so importing a single
  action from a large `actions/global.ts` previously pulled every executor into the bundle (Runde 9
  F-LMA9-01: lmapp form bundles were 200-244 kB). The factory calls only build a closure object with no
  construction-time side effect, so the annotation is safe; consumer bundles now tree-shake unused
  executors (verified: invoice 228 kB -> 28 kB, email 203 kB -> 3.6 kB). Regenerate to pick this up.

## 0.13.1

### Patch Changes

- Add package README (rendered on npmjs.com). Docs only, no code change.

## 0.13.0

### Minor Changes

- form-mapping.json now records, per form, the list of `fields` it binds to and an `isMain` marker
  (Main form = systemform_type 2), alongside the existing interface and Fields/Tabs enum names. This
  lets AI agents pick the right form for an entity with many forms by its fields, without guessing.
  Built from structured per-form metadata during generation instead of regex over the generated
  output (F-MAR7-04).
- Typed form sections now extend `Xrm.Collection.ItemCollection<Xrm.Controls.Section>` instead of a
  bare `{ get(name) }` object, so `get(index)`, `get()`, `forEach()` and `getLength()` stay available
  (legacy numeric-index section access) next to the typed `get(name)` autocomplete overloads
  (F-LMA7-10).

## 0.12.2

### Patch Changes

- Barrel index no longer re-exports Custom API action/function modules with `export *`. Bound
  MS-standard operations (e.g. `SynchronizePhoneNumbers`, `PredictResult`) carry the same exported
  name across several entity action modules, so a flat re-export collided with TS2308 on an
  unfiltered `xrmforge generate --actions` run (the `--actions-filter` workaround only masked it).
  Actions/functions are now listed as a comment hint and imported directly from their files, exactly
  like OptionSets and Fields (same name-collision reasoning). The AGENT.md examples already import
  actions directly, so the documented usage is unchanged (F-LMA7-01).

## 0.12.1

### Patch Changes

- form-generator: tab names, section names and subgrid/quick-view control ids are emitted through a
  single-quote escaper (`singleQuoted`). A FormXML name containing an apostrophe (e.g. a section
  literally named `note's information`) previously produced an unterminated string literal / invalid
  TypeScript in the generated form file (K32-02; hit independently in two showcase runs). Schema
  identifiers (entity/attribute logical names, navigation property names, custom-api unique names)
  are constrained to `[a-z0-9_]` by Dataverse and were verified apostrophe-free, so only the
  FormXML-derived emitters needed escaping; output is byte-identical when no such characters occur.

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
