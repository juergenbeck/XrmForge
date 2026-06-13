/**
 * @xrmforge/eslint-plugin - no-raw-entity-names
 *
 * Disallows raw entity-name string literals in Xrm.WebApi calls and in
 * Xrm.Navigation.openForm({ entityName }). Entity names must come from the
 * generated EntityNames enum.
 *
 * Detects:
 *   Xrm.WebApi.retrieveRecord("account", id)          // bad
 *   Xrm.WebApi.retrieveMultipleRecords("contact", q)  // bad
 *   Xrm.Navigation.openForm({ entityName: "account" }) // bad
 *
 * Does NOT flag:
 *   Xrm.WebApi.retrieveRecord(EntityNames.Account, id)
 *   Xrm.Navigation.openForm({ entityName: EntityNames.Account })
 */

import type { Rule } from 'eslint';

/** Xrm.WebApi methods whose first argument is an entity logical name */
const WEBAPI_METHODS = new Set([
  'retrieveRecord',
  'retrieveMultipleRecords',
  'createRecord',
  'updateRecord',
  'deleteRecord',
]);

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw entity-name string literals in Xrm.WebApi calls and ' +
        'Xrm.Navigation.openForm. Use the generated EntityNames enum.',
    },
    messages: {
      noRawEntity:
        'Avoid raw entity name "{{value}}" in {{where}}. ' +
        'Use the generated EntityNames enum (e.g. EntityNames.Account) instead.',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression') return;
        if (callee.property.type !== 'Identifier') return;
        const method = callee.property.name;

        // Xrm.WebApi.<method>("entity", ...): entity name is the first argument
        if (WEBAPI_METHODS.has(method)) {
          const firstArg = node.arguments[0];
          if (firstArg && firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
            context.report({
              node: firstArg,
              messageId: 'noRawEntity',
              data: { value: firstArg.value, where: `${method}()` },
            });
          }
          return;
        }

        // Xrm.Navigation.openForm({ entityName: "account" })
        if (method === 'openForm') {
          const firstArg = node.arguments[0];
          if (!firstArg || firstArg.type !== 'ObjectExpression') return;
          for (const prop of firstArg.properties) {
            if (
              prop.type === 'Property' &&
              prop.key.type === 'Identifier' &&
              prop.key.name === 'entityName' &&
              prop.value.type === 'Literal' &&
              typeof prop.value.value === 'string'
            ) {
              context.report({
                node: prop.value,
                messageId: 'noRawEntity',
                data: { value: prop.value.value, where: 'openForm entityName' },
              });
            }
          }
        }
      },
    };
  },
};

export default rule;
