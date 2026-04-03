/**
 * @xrmforge/eslint-plugin - require-namespace
 *
 * Warns when form scripts export functions directly at the module
 * level without a namespace pattern. D365 expects functions under
 * a global namespace (e.g. Contoso.Account.onLoad), which requires
 * either the esbuild globalName or an explicit namespace object.
 *
 * This rule checks that exported functions are not top-level arrow
 * functions assigned to module-scope variables that look like they
 * bypass the IIFE namespace pattern.
 *
 * Detects:
 *   window.onLoad = function() { ... }     // bad: pollutes global scope
 *   globalThis.myHandler = () => { ... }   // bad: pollutes global scope
 *
 * Does NOT flag:
 *   export function onLoad() { ... }       // fine: esbuild wraps in IIFE
 *   export const Account = { onLoad };     // fine: namespace object
 */

import type { Rule } from 'eslint';

const GLOBAL_OBJECTS = new Set(['window', 'globalThis', 'self']);

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Warn against assigning functions to global scope. Use module exports with IIFE bundler.',
    },
    messages: {
      noGlobalAssignment:
        'Avoid assigning to {{object}}.{{property}} directly. ' +
        'Use module exports and let the bundler (esbuild/webpack) handle the global namespace.',
    },
    schema: [],
  },

  create(context) {
    return {
      AssignmentExpression(node) {
        if (node.left.type !== 'MemberExpression') return;

        const obj = node.left.object;
        if (obj.type !== 'Identifier' || !GLOBAL_OBJECTS.has(obj.name)) return;

        const prop = node.left.property;
        const propName = prop.type === 'Identifier' ? prop.name : '(computed)';

        context.report({
          node,
          messageId: 'noGlobalAssignment',
          data: { object: obj.name, property: propName },
        });
      },
    };
  },
};

export default rule;
