/**
 * @xrmforge/eslint-plugin - no-magic-optionset
 *
 * Warns when raw numbers are used in comparisons with getValue()
 * on OptionSet attributes. Use generated const enums instead.
 *
 * Detects patterns like:
 *   if (attr.getValue() === 1)        // bad
 *   if (attr.getValue() !== 595300000) // bad
 *
 * Does NOT flag:
 *   if (attr.getValue() === 0)        // 0 and 1 are often boolean-like
 *   if (attr.getValue() === null)     // null checks are fine
 *   if (count === 5)                  // not a getValue() call
 */

import type { Rule } from 'eslint';

/** OptionSet values are typically > 1 (Microsoft uses 1-based for system, 595300000+ for custom) */
const MIN_SUSPICIOUS_VALUE = 2;

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Warn against raw numbers in OptionSet comparisons. Use generated const enums.',
    },
    messages: {
      noMagicOptionSet:
        'Avoid magic number {{value}} in OptionSet comparison. ' +
        'Use a generated const enum from XrmForge instead.',
    },
    schema: [],
  },

  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator !== '===' && node.operator !== '!==' &&
            node.operator !== '==' && node.operator !== '!=') {
          return;
        }

        // Check if one side is a getValue() call and the other is a number literal
        const sides = [
          { call: node.left, literal: node.right },
          { call: node.right, literal: node.left },
        ];

        for (const { call, literal } of sides) {
          if (
            literal.type === 'Literal' &&
            typeof literal.value === 'number' &&
            literal.value >= MIN_SUSPICIOUS_VALUE &&
            isGetValueCall(call as Rule.Node)
          ) {
            context.report({
              node,
              messageId: 'noMagicOptionSet',
              data: { value: String(literal.value) },
            });
            break;
          }
        }
      },
    };
  },
};

/** Check if a node is a .getValue() call expression */
function isGetValueCall(node: Rule.Node): boolean {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'getValue'
  );
}

export default rule;
