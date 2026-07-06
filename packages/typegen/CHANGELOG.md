# @xrmforge/typegen

## 0.18.0

### Minor Changes

- **HTTP client migrated onto `@xrmforge/dataverse-core`.** `DataverseHttpClient` now runs its retry /
  backoff / rate-limit / timeout resilience through the shared `ResilientRunner` from `@xrmforge/dataverse-core`
  (a new dependency), over a Node bearer-token `NodeTransport` that implements the core `DataverseTransport`
  interface. The Node-only concerns the browser-lean runner omits stay in typegen: a concurrency semaphore, HTTP
  401 token-refresh-and-retry, and `@odata.nextLink` paging. The three OData sanitizers (`sanitizeIdentifier` /
  `sanitizeGuid` / `escapeODataString`) now delegate to the single shared implementation in dataverse-core.
  Public API and behaviour are unchanged: the static sanitizer signatures, `get` / `getAll` / `isReadOnly` /
  `assertWriteAllowed`, and the `ApiRequestError` error contract are preserved (core `DataverseError`s are
  mapped back onto `ApiRequestError` by code, carrying statusCode / responseBody). The only observable change is
  a clearer, token-oriented HTTP 401 message. All 491 tests green.

## 0.17.0

### Minor Changes

- **Generate a per-entity `XxxFieldKinds` constant** (OE-16) into each `fields/<entity>.ts`, next to
  `XxxFields` / `XxxNavigationProperties` / `XxxExpands`. It is an `as const` object mapping each field's blank
  logical name to its attribute kind (`'string' | 'number' | 'boolean' | 'date' | 'optionset' | 'multiselect'
  | 'lookup'`), consumed by `@xrmforge/helpers` `typedFields` for cross-entity / cross-form field access. New
  `getAttributeKind(attributeType)` in `type-mapping.ts` condenses `FORM_ATTRIBUTE_TYPE_MAP` to the kind; a
  field whose type has no clean kind (e.g. the `Uniqueidentifier` primary id) is omitted, never guessed. Keys
  are the BLANK logical name (what `getAttribute` expects on a form), including lookups (`primarycontactid`,
  not `_primarycontactid_value`). No cache-version bump: the generator reads only existing metadata
  (`AttributeType`), so a `4` cache produces the new constant unchanged.

## 0.16.0

### Minor Changes

- **Standalone EntityName fields are now kept in entity interfaces (F-LMA11-04).**
  `shouldIncludeInEntityInterface` previously dropped every `AttributeType === 'EntityName'` attribute. That is
  correct only for a polymorphic-lookup companion (the type discriminator, e.g. `owneridtype` /
  `regardingobjecttypecode`), whose entity-type info comes from the `@Microsoft.Dynamics.CRM.lookuplogicalname`
  annotation rather than a standalone property. A genuine standalone EntityName field (`AttributeOf` null, e.g.
  `activitytypecode` on `activitypointer`) IS `$select` / FormattedValue-readable and was being lost. The filter
  now keys on `AttributeOf`: companion (`AttributeOf` set) excluded, standalone (`AttributeOf` null) kept.
  `AttributeOf` is added to `ATTRIBUTE_SELECT` and the `AttributeMetadata` type. Additive: affected entities gain
  the previously-missing field; no existing field changes. Verified live against markant-dev (`activitytypecode`
  AttributeOf null; `owneridtype` / `regardingobjecttypecode` AttributeOf set).
- **Metadata cache version `3` -> `4`.** `AttributeMetadata` now carries `AttributeOf`; a pre-0.16.0 cache lacks
  it, so every EntityName attribute would read as standalone and companions would leak into the interface. The
  bump forces a one-time full reload. No API or output change for non-cache or fresh-cache runs.

## 0.15.0

### Minor Changes

- **Generated `XxxExpands` enum per entity with a polymorphic lookup (F-MK9-08-Sub).** Provides the
  target-qualified `$expand` navigation-property names from the real relationship metadata
  (`OneToManyRelationshipMetadata.ReferencingEntityNavigationPropertyName`), never constructed. New
  `MetadataClient.getManyToOneRelationships()`, `EntityTypeInfo.manyToOneRelationships`, and
  `generateEntityExpands()` (only polymorphic lookups, `Targets.length > 1`, Owner excluded; unresolvable targets
  are warned and skipped). Metadata cache version `2` -> `3` (an old cache would emit no Expands enum for
  unchanged entities). Removes the last raw string in consumer code (Golden Rule 19). Verified live against
  markant-dev (`customerid` -> `customerid_account` / `customerid_contact`).

## 0.14.2

### Patch Changes

- Refactor: the attribute enum-member naming (SchemaName -> safe identifier, with the defensive collision
  guard) is now a single shared `buildAttributeMemberName()` in `label-utils`, used by the entity Fields enum,
  the NavigationProperties enum and the form Fields enum. Removes the threefold duplication that risked drift
  between the three call sites (R46-07). No output change (verified by the existing generator tests).

## 0.14.1

### Patch Changes

- **Bump metadata cache version to invalidate pre-0.14.0 caches (R46-01).** 0.14.0 added
  `multiSelectPicklistAttributes` to the cached `EntityTypeInfo` and started normalizing MultiSelect
  attributes (`Virtual` -> `MultiSelectPicklist`) on load. The cache manifest version was not bumped, so with
  `useCache: true` a cache written by an older typegen was accepted as compatible and an unchanged-from-cache
  entity silently missed the F-MK9-09 fix (no MultiSelect OptionSet enum, the field stayed `unknown` instead
  of `string`). `CACHE_VERSION` is now `'2'`, so stale caches are discarded and fully reloaded. No API or
  output change for non-cache or fresh-cache runs.

## 0.14.0

### Minor Changes

- **BREAKING (generated output): Fields/NavigationProperties enum members are now named after the attribute
  SchemaName, not the display label (F-MK9-05/07).** Members were derived from the field's label and
  disambiguated with an order-dependent ordinal suffix (`Foo`, `Foo2`, ...). That suffix was fragile: adding
  or reordering a same-labelled field could silently shift `Foo5` onto a different field, and label-derived
  members (`AccountFields.Status` for `statecode`) were not guessable from the logical name. Members now use
  the SchemaName (the cased logical name, e.g. `statecode` -> `StateCode`), which is unique per entity,
  deterministic, stable and guessable - the same scheme pac modelbuilder and XrmDefinitelyTyped use. The
  display label moves to the member's JSDoc (IDE tooltip). This applies to the entity-level `XxxFields` and
  `XxxNavigationProperties` enums and the form-level `XxxFormFieldsEnum`; OptionSet enum members are
  unchanged (they remain label-based with stable value-based disambiguation). **Regenerate and update any
  references to label-based members (e.g. `.Status` -> `.StateCode`).**

- **MultiSelect choice fields are now resolved (F-MK9-09).** A multi-select choice attribute reports
  AttributeType `Virtual` in the metadata and was therefore typed `unknown` in the entity interface and never
  got an OptionSet enum. typegen now identifies these via `@odata.type`, normalizes the type to
  `MultiSelectPicklist` (entity property -> `string`, form attribute -> `MultiSelectOptionSetAttribute`), and
  fetches their OptionSets through a dedicated `MultiSelectPicklistAttributeMetadata` cast query so the enum
  is generated. Adds one metadata API call per entity.

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
