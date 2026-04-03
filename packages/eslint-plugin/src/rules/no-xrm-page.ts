/**
 * @xrmforge/eslint-plugin - no-xrm-page
 *
 * Disallows usage of the deprecated Xrm.Page API.
 * Xrm.Page was deprecated in Dynamics 365 v9.0 (2017).
 * Use formContext from the execution context instead.
 *
 * @see https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/xrm-page
 */

import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow deprecated Xrm.Page API. Use formContext from execution context instead.',
    },
    messages: {
      noXrmPage:
        'Xrm.Page is deprecated since D365 v9.0. ' +
        'Use executionContext.getFormContext() instead.',
    },
    schema: [],
  },

  create(context) {
    return {
      MemberExpression(node) {
        // Match Xrm.Page
        if (
          node.object.type === 'Identifier' &&
          node.object.name === 'Xrm' &&
          node.property.type === 'Identifier' &&
          node.property.name === 'Page'
        ) {
          context.report({ node, messageId: 'noXrmPage' });
        }
      },
    };
  },
};

export default rule;
