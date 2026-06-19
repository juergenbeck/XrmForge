/**
 * @xrmforge/eslint-plugin
 *
 * ESLint rules for Dynamics 365 form scripting.
 * Catches common mistakes and enforces best practices.
 *
 * Usage (ESLint v9 flat config):
 * ```javascript
 * import xrmforge from '@xrmforge/eslint-plugin';
 *
 * export default [
 *   xrmforge.configs.recommended,
 *   // ... your other configs
 * ];
 * ```
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import noXrmPage from './rules/no-xrm-page.js';
import noMagicOptionSet from './rules/no-magic-optionset.js';
import noSyncWebapi from './rules/no-sync-webapi.js';
import requireErrorHandling from './rules/require-error-handling.js';
import requireNamespace from './rules/require-namespace.js';
import noTypegenImport from './rules/no-typegen-import.js';
import noRawFieldStrings from './rules/no-raw-field-strings.js';
import noRawEntityNames from './rules/no-raw-entity-names.js';
import noRawSelect from './rules/no-raw-select.js';

// Read version from package.json (single source of truth, avoids stale literal drift)
const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf-8'));

const plugin = {
  meta: {
    name: '@xrmforge/eslint-plugin',
    version: pkg.version,
  },

  rules: {
    'no-xrm-page': noXrmPage,
    'no-magic-optionset': noMagicOptionSet,
    'no-sync-webapi': noSyncWebapi,
    'require-error-handling': requireErrorHandling,
    'require-namespace': requireNamespace,
    'no-typegen-import': noTypegenImport,
    'no-raw-field-strings': noRawFieldStrings,
    'no-raw-entity-names': noRawEntityNames,
    'no-raw-select': noRawSelect,
  },

  configs: {} as Record<string, unknown>,
};

// Recommended config (ESLint v9 flat config format)
plugin.configs['recommended'] = {
  plugins: {
    '@xrmforge': plugin,
  },
  rules: {
    '@xrmforge/no-xrm-page': 'error',
    '@xrmforge/no-magic-optionset': 'warn',
    '@xrmforge/no-sync-webapi': 'error',
    '@xrmforge/require-error-handling': 'warn',
    '@xrmforge/require-namespace': 'warn',
    '@xrmforge/no-typegen-import': 'error',
    '@xrmforge/no-raw-field-strings': 'error',
    '@xrmforge/no-raw-entity-names': 'error',
    '@xrmforge/no-raw-select': 'error',
  },
};

export default plugin;
export {
  noXrmPage,
  noMagicOptionSet,
  noSyncWebapi,
  requireErrorHandling,
  requireNamespace,
  noTypegenImport,
  noRawFieldStrings,
  noRawEntityNames,
  noRawSelect,
};
