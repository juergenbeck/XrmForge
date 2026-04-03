/**
 * @xrmforge/eslint-plugin - require-error-handling
 *
 * Warns when async event handlers (onLoad, onSave, onChange, etc.)
 * don't have a try/catch block. Unhandled rejections in D365 form
 * scripts silently fail and leave the user with a broken form.
 *
 * Detects exported async functions whose names start with "on":
 *   export async function onLoad(ctx) { ... }    // needs try/catch
 *   export async function onChange(ctx) { ... }   // needs try/catch
 *   export async function helper() { ... }        // ignored (not "on*")
 */

import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require try/catch in async form event handlers (on* functions).',
    },
    messages: {
      requireTryCatch:
        'Async event handler "{{name}}" should wrap its body in try/catch. ' +
        'Unhandled rejections in D365 form scripts fail silently.',
    },
    schema: [],
  },

  create(context) {
    return {
      ExportNamedDeclaration(node) {
        const decl = node.declaration;
        if (!decl || decl.type !== 'FunctionDeclaration') return;
        if (!decl.async) return;
        if (!decl.id || !decl.id.name.startsWith('on')) return;

        // Check if the function body has a try statement at the top level
        const body = decl.body.body;
        const hasTryCatch = body.some((stmt) => stmt.type === 'TryStatement');

        if (!hasTryCatch) {
          context.report({
            node: decl,
            messageId: 'requireTryCatch',
            data: { name: decl.id.name },
          });
        }
      },
    };
  },
};

export default rule;
