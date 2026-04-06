/**
 * @xrmforge/eslint-plugin - no-typegen-import
 *
 * Disallows importing from @xrmforge/typegen in browser code (src/).
 * @xrmforge/typegen is a Node.js CLI tool that pulls in @azure/identity,
 * fast-xml-parser, and other Node dependencies.
 * For browser-safe runtime functions, use @xrmforge/helpers instead.
 */

import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow importing from @xrmforge/typegen in browser code. ' +
        'Use @xrmforge/helpers for browser-safe runtime functions.',
    },
    messages: {
      noTypegenImport:
        'Do not import from @xrmforge/typegen in browser code. ' +
        'It is a Node.js CLI tool and pulls in Node.js dependencies. ' +
        'Use @xrmforge/helpers for select(), parseLookup(), formLookup(), createUnboundAction(), etc.',
    },
    schema: [],
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (
          typeof source === 'string' &&
          (source === '@xrmforge/typegen' || source.startsWith('@xrmforge/typegen/'))
        ) {
          context.report({ node, messageId: 'noTypegenImport' });
        }
      },
    };
  },
};

export default rule;
