/**
 * @xrmforge/typegen - Form Interface Generator
 *
 * Generates TypeScript form interfaces with compile-time field validation.
 *
 * Architecture:
 * 1. Union Type (LeadFormFields): restricts getAttribute to form-specific fields only
 * 2. Mapped Return Type (LeadAttributeMap): maps field name to correct Xrm type
 * 3. Generic getAttribute<K>: returns the exact type for each field
 * 4. Fields const enum: provides autocomplete with dual-language labels
 * 5. NO fallback getAttribute(name: string): unknown fields are compile errors
 *
 * Output pattern:
 * ```typescript
 * declare namespace XrmForge.Forms.Account {
 *   type AccountMainFormFields = "name" | "telephone1" | "revenue";
 *
 *   type AccountMainFormAttributeMap = {
 *     name: Xrm.Attributes.StringAttribute;
 *     telephone1: Xrm.Attributes.StringAttribute;
 *     revenue: Xrm.Attributes.NumberAttribute;
 *   };
 *
 *   type AccountMainFormControlMap = {
 *     name: Xrm.Controls.StringControl;
 *     telephone1: Xrm.Controls.StringControl;
 *     revenue: Xrm.Controls.NumberControl;
 *   };
 *
 *   const enum AccountMainFormFields {
 *     Name = 'name',
 *     Telephone1 = 'telephone1',
 *     Revenue = 'revenue',
 *   }
 *
 *   interface AccountMainForm extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'> {
 *     getAttribute<K extends AccountMainFormFields>(name: K): AccountMainFormAttributeMap[K];
 *     getAttribute(index: number): Xrm.Attributes.Attribute;
 *     getAttribute(): Xrm.Attributes.Attribute[];
 *     getControl<K extends AccountMainFormFields>(name: K): AccountMainFormControlMap[K];
 *     getControl(index: number): Xrm.Controls.Control;
 *     getControl(): Xrm.Controls.Control[];
 *   }
 * }
 * ```
 */

import type { ParsedForm, AttributeMetadata, SpecialControlType } from '../metadata/types.js';
import { getFormAttributeType, getFormControlType, toPascalCase } from './type-mapping.js';
import { transliterateUmlauts, formatDualLabel, getPrimaryLabel, type LabelConfig, DEFAULT_LABEL_CONFIG } from './label-utils.js';

/** Map special control types to @types/xrm control interfaces */
function specialControlToXrmType(controlType: SpecialControlType): string | null {
  switch (controlType) {
    case 'subgrid': return 'Xrm.Controls.GridControl';
    case 'editablegrid': return 'Xrm.Controls.GridControl';
    case 'quickview': return 'Xrm.Controls.QuickFormControl';
    case 'webresource': return 'Xrm.Controls.IframeControl';
    case 'iframe': return 'Xrm.Controls.IframeControl';
    case 'notes': return 'Xrm.Controls.Control';
    case 'map': return 'Xrm.Controls.Control';
    default: return null;
  }
}

/** Options for form interface generation */
export interface FormGeneratorOptions {
  /** Label configuration for dual-language JSDoc comments */
  labelConfig?: LabelConfig;
  /** Namespace prefix for generated types (default: "XrmForge.Forms") */
  namespacePrefix?: string;
  /** Form types to include (default: [2] = Main only) */
  formTypes?: number[];
}

/** Build a safe TypeScript identifier from a form name */
function toSafeFormName(formName: string): string {
  return transliterateUmlauts(formName)
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/**
 * Build the interface base name, avoiding redundant prefix.
 * "Account" + "Account" -> "Account" (not "AccountAccount")
 * "Lead" + "Markant Lead" -> "LeadMarkantLead"
 */
function buildFormBaseName(entityPascal: string, safeFormName: string): string {
  // If form name starts with entity name, don't prefix
  if (safeFormName.startsWith(entityPascal)) {
    return safeFormName;
  }
  return `${entityPascal}${safeFormName}`;
}

/** Convert a label to a PascalCase enum member name */
function labelToPascalMember(label: string): string {
  if (!label) return '';
  const transliterated = transliterateUmlauts(label);
  const cleaned = transliterated.replace(/[^a-zA-Z0-9\s_]/g, '');
  const parts = cleaned.split(/[\s_]+/).filter((p) => p.length > 0);
  if (parts.length === 0) return '';
  const pascal = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
  if (/^\d/.test(pascal)) return `_${pascal}`;
  return pascal;
}

/**
 * Generate a complete form declaration: union type, mapped types, fields enum, and interface.
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
  const labelConfig = options.labelConfig || DEFAULT_LABEL_CONFIG;
  const namespacePrefix = options.namespacePrefix || 'XrmForge.Forms';
  const entityPascal = toPascalCase(entityLogicalName);
  const namespace = `${namespacePrefix}.${entityPascal}`;
  const safeFormName = toSafeFormName(form.name);
  const baseName = buildFormBaseName(entityPascal, safeFormName);
  const interfaceName = `${baseName}Form`;
  const fieldsTypeName = `${baseName}FormFields`;
  const attrMapName = `${baseName}FormAttributeMap`;
  const ctrlMapName = `${baseName}FormControlMap`;

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
    label: string;
    enumMemberName: string;
  }> = [];

  const usedEnumNames = new Set<string>();

  for (const fieldName of [...fieldNames].sort()) {
    const attr = attributeMap.get(fieldName);
    if (!attr) continue;

    // Build enum member name from label (English primary)
    const primaryLabel = getPrimaryLabel(attr.DisplayName, labelConfig);
    let enumMember = labelToPascalMember(primaryLabel);
    if (!enumMember) {
      enumMember = toPascalCase(fieldName);
    }

    // Disambiguate enum member names
    const originalEnumMember = enumMember;
    let counter = 2;
    while (usedEnumNames.has(enumMember)) {
      enumMember = `${originalEnumMember}${counter}`;
      counter++;
    }
    usedEnumNames.add(enumMember);

    const dualLabel = formatDualLabel(attr.DisplayName, labelConfig);

    fields.push({
      logicalName: fieldName,
      attributeType: attr.AttributeType,
      formAttributeType: getFormAttributeType(attr.AttributeType),
      formControlType: getFormControlType(attr.AttributeType),
      label: dualLabel,
      enumMemberName: enumMember,
    });
  }

  const lines: string[] = [];

  // Namespace
  lines.push(`declare namespace ${namespace} {`);
  lines.push('');

  // 1. Union Type: restricts which field names are valid
  lines.push(`  /** Valid field names for the "${form.name}" form */`);
  lines.push(`  type ${fieldsTypeName} =`);
  for (let i = 0; i < fields.length; i++) {
    const separator = i === fields.length - 1 ? ';' : '';
    lines.push(`    | "${fields[i]!.logicalName}"${separator}`);
  }
  lines.push('');

  // 2. Attribute Map: maps field name to Xrm.Attributes.* type
  lines.push(`  /** Attribute type map for "${form.name}" */`);
  lines.push(`  type ${attrMapName} = {`);
  for (const field of fields) {
    lines.push(`    ${field.logicalName}: ${field.formAttributeType};`);
  }
  lines.push('  };');
  lines.push('');

  // 3. Control Map: maps field name to Xrm.Controls.* type
  lines.push(`  /** Control type map for "${form.name}" */`);
  lines.push(`  type ${ctrlMapName} = {`);
  for (const field of fields) {
    lines.push(`    ${field.logicalName}: ${field.formControlType};`);
  }
  lines.push('  };');
  lines.push('');

  // 4. Fields const enum: autocomplete with dual-language labels
  lines.push(`  /** Field constants for "${form.name}" (compile-time only, zero runtime) */`);
  lines.push(`  const enum ${fieldsTypeName}Enum {`);
  for (const field of fields) {
    if (field.label) {
      lines.push(`    /** ${field.label} */`);
    }
    lines.push(`    ${field.enumMemberName} = '${field.logicalName}',`);
  }
  lines.push('  }');
  lines.push('');

  // 4b. Tabs const enum
  const namedTabs = form.tabs.filter((t) => t.name);
  if (namedTabs.length > 0) {
    const tabsEnumName = `${baseName}FormTabs`;
    lines.push(`  /** Tab constants for "${form.name}" (compile-time only, zero runtime) */`);
    lines.push(`  const enum ${tabsEnumName} {`);
    for (const tab of namedTabs) {
      if (tab.label) {
        lines.push(`    /** ${tab.label} */`);
      }
      const memberName = toSafeFormName(tab.name) || toPascalCase(tab.name);
      lines.push(`    ${memberName} = '${tab.name}',`);
    }
    lines.push('  }');
    lines.push('');

    // 4c. Section const enums (one per tab)
    for (const tab of namedTabs) {
      const namedSections = tab.sections.filter((s) => s.name);
      if (namedSections.length === 0) continue;

      const tabMemberName = toSafeFormName(tab.name) || toPascalCase(tab.name);
      const sectionsEnumName = `${baseName}Form${tabMemberName}Sections`;
      lines.push(`  /** Section constants for tab "${tab.name}" (compile-time only, zero runtime) */`);
      lines.push(`  const enum ${sectionsEnumName} {`);
      for (const section of namedSections) {
        if (section.label) {
          lines.push(`    /** ${section.label} */`);
        }
        const sectionMember = toSafeFormName(section.name) || toPascalCase(section.name);
        lines.push(`    ${sectionMember} = '${section.name}',`);
      }
      lines.push('  }');
      lines.push('');
    }
  }

  // 5. Form Interface: generic getAttribute/getControl with compile-time validation
  lines.push(`  /** ${form.name} */`);
  lines.push(`  interface ${interfaceName} extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'> {`);
  lines.push(`    /** Typisierter Feldzugriff: nur Felder die auf diesem Formular existieren */`);
  lines.push(`    getAttribute<K extends ${fieldsTypeName}>(name: K): ${attrMapName}[K];`);
  lines.push('    getAttribute(index: number): Xrm.Attributes.Attribute;');
  lines.push('    getAttribute(): Xrm.Attributes.Attribute[];');
  lines.push('');
  lines.push(`    /** Typisierter Control-Zugriff: nur Controls die auf diesem Formular existieren */`);
  lines.push(`    getControl<K extends ${fieldsTypeName}>(name: K): ${ctrlMapName}[K];`);

  // Typed getControl overloads for special controls (subgrids, quick views, etc.)
  const specialControls = form.allSpecialControls || [];
  for (const sc of specialControls) {
    const xrmType = specialControlToXrmType(sc.controlType);
    if (xrmType) {
      lines.push(`    getControl(name: "${sc.id}"): ${xrmType};`);
    }
  }

  lines.push('    getControl(index: number): Xrm.Controls.Control;');
  lines.push('    getControl(): Xrm.Controls.Control[];');

  // 6. Typed ui.tabs for compile-time tab name validation
  if (form.tabs.length > 0) {
    lines.push('');
    lines.push('    /** Typisierter Tab-Zugriff */');
    lines.push('    ui: {');
    lines.push('      tabs: {');
    for (const tab of form.tabs) {
      if (tab.name) {
        const sectionNames = tab.sections.filter((s) => s.name).map((s) => s.name);
        if (sectionNames.length > 0) {
          // Tab with typed sections
          lines.push(`        get(name: "${tab.name}"): Xrm.Controls.Tab & {`);
          lines.push('          sections: {');
          for (const sectionName of sectionNames) {
            lines.push(`            get(name: "${sectionName}"): Xrm.Controls.Section;`);
          }
          lines.push('            get(name: string): Xrm.Controls.Section;');
          lines.push('          };');
          lines.push('        };');
        } else {
          lines.push(`        get(name: "${tab.name}"): Xrm.Controls.Tab;`);
        }
      }
    }
    lines.push('        get(name: string): Xrm.Controls.Tab;');
    lines.push('      };');
    lines.push('    } & Xrm.Ui;');
  }

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
    const safeFormName = toSafeFormName(form.name);
    const baseName = buildFormBaseName(entityPascal, safeFormName);
    const interfaceName = `${baseName}Form`;

    const content = generateFormInterface(form, entityLogicalName, attributeMap, options);
    results.push({ formName: form.name, interfaceName, content });
  }

  return results;
}
