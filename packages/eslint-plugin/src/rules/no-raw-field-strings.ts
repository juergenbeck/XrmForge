/**
 * @xrmforge/eslint-plugin - no-raw-field-strings
 *
 * Disallows raw string literals as the field name in getAttribute()/getControl().
 * Field names must come from a generated Fields enum so that renamed/removed
 * fields fail at compile time instead of silently at runtime.
 *
 * Detects:
 *   form.getAttribute("name")          // bad
 *   formContext.getControl("revenue")  // bad
 *
 * Does NOT flag (the field name comes from an enum or variable):
 *   form.getAttribute(Fields.Name)
 *   form.getControl(fieldName)
 *   form.getAttribute()                 // collection overload, no argument
 *
 * Note: this is AST-based and matches getAttribute/getControl by name. A DOM
 * `element.getAttribute("class")` is rare in D365 form scripts but would also
 * match; suppress with an inline eslint-disable in that uncommon case.
 */

import type { Rule } from 'eslint';

/** Xrm FormContext accessors that take a field/control logical name */
const FIELD_ACCESSORS = new Set(['getAttribute', 'getControl']);

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw string literals in getAttribute()/getControl(). ' +
        'Use a generated Fields enum (e.g. AccountFormFieldsEnum.Name).',
    },
    messages: {
      noRawField:
        'Avoid raw string "{{value}}" in {{method}}(). ' +
        'Use a generated Fields enum (e.g. AccountFormFieldsEnum.Name) instead.',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression') return;
        if (callee.property.type !== 'Identifier') return;
        if (!FIELD_ACCESSORS.has(callee.property.name)) return;

        const firstArg = node.arguments[0];
        if (firstArg && firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
          context.report({
            node: firstArg,
            messageId: 'noRawField',
            data: { value: firstArg.value, method: callee.property.name },
          });
        }
      },
    };
  },
};

export default rule;
