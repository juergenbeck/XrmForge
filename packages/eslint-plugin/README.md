# @xrmforge/eslint-plugin

[![npm version](https://img.shields.io/npm/v/@xrmforge/eslint-plugin.svg)](https://www.npmjs.com/package/@xrmforge/eslint-plugin)
[![license](https://img.shields.io/npm/l/@xrmforge/eslint-plugin.svg)](https://github.com/juergenbeck/XrmForge/blob/main/LICENSE)

**D365-specific ESLint rules for Dynamics 365 form scripting with XrmForge.** Catches the mistakes a generic TypeScript linter cannot see: deprecated `Xrm.Page`, raw field/entity strings, magic OptionSet numbers, synchronous Web API calls, and missing error handling in event handlers.

> Part of [XrmForge](https://github.com/juergenbeck/XrmForge#readme). Built for ESLint v9 flat config.

---

## Installation

```bash
npm install --save-dev @xrmforge/eslint-plugin eslint
```

**Requirements:** ESLint >= 8 (peer dependency; flat config needs ESLint v9).

---

## Setup (flat config)

Add the recommended config to your `eslint.config.mjs`:

```javascript
import xrmforge from '@xrmforge/eslint-plugin';

export default [
  xrmforge.configs.recommended,
  // ... your other configs
];
```

The default export is the plugin object; `xrmforge.configs.recommended` registers the plugin under the `@xrmforge` namespace and enables the rules below at their recommended severities.

---

## Rules

| Rule | Recommended | What it catches |
|------|-------------|-----------------|
| `no-xrm-page` | error | Deprecated `Xrm.Page` API. Use `formContext` from the execution context instead. |
| `no-sync-webapi` | error | Synchronous `XMLHttpRequest`. Use `Xrm.WebApi` or `fetch()` instead. |
| `no-typegen-import` | error | Importing `@xrmforge/typegen` in browser code (it pulls in Node APIs). Use `@xrmforge/helpers`. |
| `no-raw-field-strings` | error | Raw string literals in `getAttribute()` / `getControl()`. Use a generated `Fields` enum. |
| `no-raw-entity-names` | error | Raw entity-name string literals in `Xrm.WebApi` calls. Use the generated `EntityNames` enum. |
| `no-raw-select` | error | Raw field-name literals in `select()` / `selectExpand()`. Use a generated `Fields` enum. |
| `no-magic-optionset` | warn | Raw numbers in OptionSet comparisons. Use the generated OptionSet `const enum`. |
| `require-error-handling` | warn | `async` form event handlers (`on*`) without `try`/`catch`. |
| `require-namespace` | warn | Assigning functions to the global scope. Use module exports with the IIFE bundler. |

---

## Configuring individual rules

Override severities or enable rules not in the recommended set by referencing them under the `@xrmforge/` prefix:

```javascript
import xrmforge from '@xrmforge/eslint-plugin';

export default [
  xrmforge.configs.recommended,
  {
    rules: {
      '@xrmforge/no-magic-optionset': 'error',     // promote from warn to error
      '@xrmforge/require-error-handling': 'off',    // disable for a file group
    },
  },
];
```

Each rule is also exported individually (`noXrmPage`, `noMagicOptionSet`, `noSyncWebapi`, `requireErrorHandling`, `requireNamespace`, `noTypegenImport`, `noRawFieldStrings`, `noRawEntityNames`, `noRawSelect`) for building a custom config.

---

## Why these rules

XrmForge's premise is that every string referencing a Dataverse resource should come from a generated constant. TypeScript alone cannot enforce that -- `getAttribute("naem")` is valid TypeScript. These rules close that gap, so the "no raw strings" guarantee holds in practice and not just by convention.

## Documentation

Full guide: [XrmForge on GitHub](https://github.com/juergenbeck/XrmForge#readme).

## License

[MIT](https://github.com/juergenbeck/XrmForge/blob/main/LICENSE) (c) XrmForge Contributors.
