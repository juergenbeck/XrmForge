/**
 * @xrmforge/typegen - Form Interface Generator
 *
 * Generates TypeScript form interfaces that extend Xrm.FormContext
 * with typed getAttribute() and getControl() overloads based on FormXml.
 *
 * Only fields that actually appear on the form are included.
 * This is the key difference from entity interfaces (which include all attributes).
 *
 * Output pattern:
 * ```typescript
 * declare namespace XrmForge.Forms.Account {
 *   interface AccountMainForm extends Xrm.FormContext {
 *     getAttribute(name: "name"): Xrm.Attributes.StringAttribute;
 *     getControl(name: "name"): Xrm.Controls.StringControl;
 *     getAttribute(name: string): Xrm.Attributes.Attribute;
 *     getControl(name: string): Xrm.Controls.Control;
 *   }
 * }
 * ```
 */

import type { ParsedForm, AttributeMetadata } from '../metadata/types.js';
import { getFormAttributeType, getFormControlType, toPascalCase } from './type-mapping.js';
import { transliterateUmlauts } from './label-utils.js';
import type { LabelConfig } from './label-utils.js';

/** Options for form interface generation */
export interface FormGeneratorOptions {
  /** Label configuration for dual-language JSDoc comments */
  labelConfig?: LabelConfig;
  /** Namespace prefix for generated types (default: "XrmForge.Forms") */
  namespacePrefix?: string;
  /** Form types to include (default: [2] = Main only) */
  formTypes?: number[];
}

/**
 * Generate a TypeScript form interface declaration.
 *
 * @param form - Parsed form structure (from FormXml parser)
 * @param entityLogicalName - Entity this form belongs to
 * @param attributeMap - Map of LogicalName to AttributeMetadata for type resolution
 * @param options - Generator options
 * @returns TypeScript declaration string
 */
export function generateFormInterface(
  form: ParsedForm,
  entityLogicalName: string,
  attributeMap: Map<string, AttributeMetadata>,
  options: FormGeneratorOptions = {},
): string {
  const namespacePrefix = options.namespacePrefix || 'XrmForge.Forms';
  const entityPascal = toPascalCase(entityLogicalName);
  const namespace = `${namespacePrefix}.${entityPascal}`;

  // Build safe interface name from form name (transliterate umlauts first, then sanitize)
  const safeFormName = transliterateUmlauts(form.name)
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  const interfaceName = `${entityPascal}${safeFormName}Form`;

  // Get unique field names from form controls (deduplicate across tabs/sections)
  const fieldNames = new Set<string>();
  for (const control of form.allControls) {
    if (control.datafieldname) {
      fieldNames.add(control.datafieldname);
    }
  }

  // Resolve field types from attribute metadata
  const fields: Array<{
    logicalName: string;
    attributeType: string;
    formAttributeType: string;
    formControlType: string;
  }> = [];

  for (const fieldName of [...fieldNames].sort()) {
    const attr = attributeMap.get(fieldName);
    if (!attr) continue; // Skip fields not found in metadata

    fields.push({
      logicalName: fieldName,
      attributeType: attr.AttributeType,
      formAttributeType: getFormAttributeType(attr.AttributeType),
      formControlType: getFormControlType(attr.AttributeType),
    });
  }

  const lines: string[] = [];

  // Namespace
  lines.push(`declare namespace ${namespace} {`);
  lines.push('');

  // Interface JSDoc
  // Note: We use Omit<> to remove the base getAttribute/getControl signatures
  // before adding our typed overloads. This prevents TypeScript signature
  // incompatibility with @types/xrm's MatchingDelegate overloads.
  lines.push(`  /** ${form.name} */`);
  lines.push(`  interface ${interfaceName} extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'> {`);

  // getAttribute overloads
  for (const field of fields) {
    lines.push(`    getAttribute(name: "${field.logicalName}"): ${field.formAttributeType};`);
  }
  // Fallback signatures (compatible with base FormContext)
  lines.push('    getAttribute(name: string): Xrm.Attributes.Attribute;');
  lines.push('    getAttribute(index: number): Xrm.Attributes.Attribute;');
  lines.push('    getAttribute(): Xrm.Attributes.Attribute[];');
  lines.push('');

  // getControl overloads
  for (const field of fields) {
    lines.push(`    getControl(name: "${field.logicalName}"): ${field.formControlType};`);
  }
  // Fallback signatures (compatible with base FormContext)
  lines.push('    getControl(name: string): Xrm.Controls.Control;');
  lines.push('    getControl(index: number): Xrm.Controls.Control;');
  lines.push('    getControl(): Xrm.Controls.Control[];');

  lines.push('  }');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate form interfaces for all forms of an entity.
 *
 * @param forms - Parsed forms (from FormXml parser)
 * @param entityLogicalName - Entity logical name
 * @param attributes - All attributes of the entity (for type resolution)
 * @param options - Generator options
 * @returns Array of { formName, interfaceName, content }
 */
export function generateEntityForms(
  forms: ParsedForm[],
  entityLogicalName: string,
  attributes: AttributeMetadata[],
  options: FormGeneratorOptions = {},
): Array<{ formName: string; interfaceName: string; content: string }> {
  // Build attribute lookup map
  const attributeMap = new Map<string, AttributeMetadata>();
  for (const attr of attributes) {
    attributeMap.set(attr.LogicalName, attr);
  }

  const results: Array<{ formName: string; interfaceName: string; content: string }> = [];

  for (const form of forms) {
    // Skip forms with no controls
    if (form.allControls.length === 0) continue;

    const entityPascal = toPascalCase(entityLogicalName);
    const safeFormName = transliterateUmlauts(form.name)
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');
    const interfaceName = `${entityPascal}${safeFormName}Form`;

    const content = generateFormInterface(form, entityLogicalName, attributeMap, options);
    results.push({ formName: form.name, interfaceName, content });
  }

  return results;
}
