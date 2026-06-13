/**
 * @xrmforge/eslint-plugin - no-raw-select
 *
 * Disallows raw field-name string literals in select()/selectExpand() from
 * @xrmforge/helpers. Field names must come from a generated entity Fields enum.
 *
 * Detects:
 *   select("name", "revenue")            // bad (variadic)
 *   select(["name", "revenue"])          // bad (array)
 *   selectExpand(["name"], expand)       // bad (first arg = field array)
 *
 * Does NOT flag:
 *   select(AccountFields.Name, AccountFields.Revenue)
 *   selectExpand([AccountFields.Name], "primarycontactid($select=fullname)")
 *
 * For selectExpand only the first argument (the field list) is checked; the
 * second argument is the $expand clause, a composite string, not a field name.
 */

import type { Rule } from 'eslint';

/** Helper functions from @xrmforge/helpers whose field arguments must be enums */
const SELECT_FNS = new Set(['select', 'selectExpand']);

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw field-name string literals in select()/selectExpand(). ' +
        'Use a generated entity Fields enum (e.g. AccountFields.Name).',
    },
    messages: {
      noRawSelect:
        'Avoid raw field name "{{value}}" in {{fn}}(). ' +
        'Use a generated entity Fields enum (e.g. AccountFields.Name) instead.',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'Identifier') return;
        if (!SELECT_FNS.has(callee.name)) return;
        const fn = callee.name;

        // selectExpand(fields, expand): only the first arg holds field names.
        // select(...fields) / select([fields]): every argument holds field names.
        const argsToCheck = fn === 'selectExpand'
          ? node.arguments.slice(0, 1)
          : node.arguments;

        for (const arg of argsToCheck) {
          if (arg.type === 'Literal' && typeof arg.value === 'string') {
            context.report({
              node: arg,
              messageId: 'noRawSelect',
              data: { value: arg.value, fn },
            });
          } else if (arg.type === 'ArrayExpression') {
            for (const el of arg.elements) {
              if (el && el.type === 'Literal' && typeof el.value === 'string') {
                context.report({
                  node: el,
                  messageId: 'noRawSelect',
                  data: { value: el.value, fn },
                });
              }
            }
          }
        }
      },
    };
  },
};

export default rule;
