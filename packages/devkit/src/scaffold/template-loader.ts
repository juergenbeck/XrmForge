/**
 * Template loader for scaffold templates.
 *
 * Reads template files from the templates/ directory relative to this module.
 * Supports {{placeholder}} variable substitution.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Path to the templates directory (relative to compiled output or source). */
const TEMPLATES_DIR = join(__dirname, 'templates');

/**
 * Load a template file by name and optionally substitute variables.
 *
 * Variables in the template use the `{{key}}` syntax.
 *
 * @param name - Template filename (e.g. 'AGENT.md', 'example-form.ts')
 * @param vars - Optional key-value pairs for placeholder substitution
 * @returns Template content with variables replaced
 */
export async function loadTemplate(
  name: string,
  vars?: Record<string, string>,
): Promise<string> {
  const content = await readFile(join(TEMPLATES_DIR, name), 'utf-8');

  if (!vars || Object.keys(vars).length === 0) {
    return content;
  }

  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    content,
  );
}
