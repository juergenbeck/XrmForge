/**
 * @xrmforge/eslint-plugin - no-sync-webapi
 *
 * Disallows synchronous XMLHttpRequest in D365 form scripts.
 * Synchronous XHR blocks the UI thread and is deprecated in modern browsers.
 * Use Xrm.WebApi (async) or fetch() instead.
 *
 * Detects:
 *   new XMLHttpRequest()
 *   xhr.open("GET", url, false)  // third arg = false means synchronous
 */

import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow synchronous XMLHttpRequest. Use Xrm.WebApi or fetch() instead.',
    },
    messages: {
      noSyncXhr:
        'Avoid XMLHttpRequest in D365 form scripts. ' +
        'Use Xrm.WebApi (async) or fetch() instead.',
      noSyncOpen:
        'Synchronous XMLHttpRequest (async=false) blocks the UI thread. ' +
        'Use async requests or Xrm.WebApi instead.',
    },
    schema: [],
  },

  create(context) {
    return {
      // new XMLHttpRequest()
      NewExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'XMLHttpRequest'
        ) {
          context.report({ node, messageId: 'noSyncXhr' });
        }
      },

      // xhr.open("GET", url, false) - third argument explicitly false
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'open' &&
          node.arguments.length >= 3
        ) {
          const asyncArg = node.arguments[2];
          if (asyncArg && asyncArg.type === 'Literal' && asyncArg.value === false) {
            context.report({ node, messageId: 'noSyncOpen' });
          }
        }
      },
    };
  },
};

export default rule;
