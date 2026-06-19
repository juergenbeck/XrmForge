# @xrmforge/eslint-plugin

## 0.3.1

### Patch Changes

- Add package README (rendered on npmjs.com). Docs only, no code change.

## 0.3.0

### Minor Changes

- Three new AST rules for the "no raw strings" vision, all `error` in `recommended`:
  `no-raw-field-strings` (string literal as first arg of getAttribute/getControl),
  `no-raw-entity-names` (string literal in Xrm.WebApi CRUD methods and openForm entityName),
  `no-raw-select` (string literal in select/selectExpand). 53 tests (Backlog A).

## 0.2.1

### Patch Changes

- New rule `no-typegen-import`: prevents importing @xrmforge/typegen in browser code (it would pull
  Node dependencies into the bundle). Six rules total with the recommended config.

## 0.2.0

### Minor Changes

- Two new rules: `require-error-handling` and `require-namespace`. Promoted from planned to released
  and wired into the scaffold's recommended config.

## 0.1.0

### Minor Changes

- Initial release. D365-specific ESLint rules on ESLint v9 flat config with a `recommended` config:
  `no-xrm-page` (error, forbids the deprecated Xrm.Page API), `no-magic-optionset` (warn, bare
  numbers in OptionSet comparisons), `no-sync-webapi` (error, forbids synchronous XMLHttpRequest).
  21 tests.
