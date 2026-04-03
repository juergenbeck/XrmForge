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

import noXrmPage from './rules/no-xrm-page.js';
import noMagicOptionSet from './rules/no-magic-optionset.js';
import noSyncWebapi from './rules/no-sync-webapi.js';
import requireErrorHandling from './rules/require-error-handling.js';
import requireNamespace from './rules/require-namespace.js';

const plugin = {
  meta: {
    name: '@xrmforge/eslint-plugin',
    version: '0.2.0',
  },

  rules: {
    'no-xrm-page': noXrmPage,
    'no-magic-optionset': noMagicOptionSet,
    'no-sync-webapi': noSyncWebapi,
    'require-error-handling': requireErrorHandling,
    'require-namespace': requireNamespace,
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
  },
};

export default plugin;
export { noXrmPage, noMagicOptionSet, noSyncWebapi, requireErrorHandling, requireNamespace };
