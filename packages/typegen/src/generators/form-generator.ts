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
 * Output pattern (flat ES module, one file per entity, all forms combined):
 * ```typescript
 * export type AccountMainFormFields = "name" | "telephone1" | "revenue";
 *
 * export type AccountMainFormAttributeMap = {
 *   name: Xrm.Attributes.StringAttribute;
 *   telephone1: Xrm.Attributes.StringAttribute;
 *   revenue: Xrm.Attributes.NumberAttribute;
 * };
 *
 * export type AccountMainFormControlMap = {
 *   name: Xrm.Controls.StringControl;
 *   telephone1: Xrm.Controls.StringControl;
 *   revenue: Xrm.Controls.NumberControl;
 * };
 *
 * export const enum AccountMainFormFieldsEnum {
 *   Name = 'name',
 *   Telephone1 = 'telephone1',
 *   Revenue = 'revenue',
 * }
 *
 * export interface AccountMainForm extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'> {
 *   getAttribute<K extends AccountMainFormFields>(name: K): AccountMainFormAttributeMap[K];
 *   getAttribute(index: number): Xrm.Attributes.Attribute;
 *   getAttribute(): Xrm.Attributes.Attribute[];
 *   getControl<K extends AccountMainFormFields>(name: K): AccountMainFormControlMap[K];
 *   getControl(index: number): Xrm.Controls.Control;
 *   getControl(): Xrm.Controls.Control[];
 * }
 * // plus ...FormTabs/...Sections/...FormSubgrids enums, ...FormTypeInfo, ...FormMockValues
 * ```
 */

import type { ParsedForm, AttributeMetadata, SpecialControlType } from '../metadata/types.js';
import {
  getFormAttributeType,
  getFormControlType,
  getFormMockValueType,
  toPascalCase,
} from './type-mapping.js';
import { transliterateUmlauts, formatDualLabel, getPrimaryLabel, type LabelConfig, DEFAULT_LABEL_CONFIG } from './label-utils.js';
import { singleQuoted } from './string-escape.js';

/** Dataverse SystemForm type code for Quick Create forms (systemform_type) */
const FORM_TYPE_QUICK_CREATE = 7;

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
  /** Form types to include (default: [2] = Main only) */
  formTypes?: number[];
}

/** Build a safe TypeScript identifier from a form/tab/section name */
function toSafeFormName(formName: string): string {
  const result = transliterateUmlauts(formName)
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

  // Prefix with _ if starts with digit (e.g. GUID-based section names)
  if (/^\d/.test(result)) return `_${result}`;
  if (result.length === 0) return '_Unnamed';
  return result;
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
  baseNameOverride?: string,
): string {
  const labelConfig = options.labelConfig || DEFAULT_LABEL_CONFIG;
  const entityPascal = toPascalCase(entityLogicalName);
  const baseName = baseNameOverride || buildFormBaseName(entityPascal, toSafeFormName(form.name));
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

  // Always include statuscode/statecode - these system fields have no FormXml control
  // but are accessible via getAttribute() and commonly used in legacy code
  for (const systemField of ['statuscode', 'statecode']) {
    if (attributeMap.has(systemField)) {
      fieldNames.add(systemField);
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

  // 1. Union Type: restricts which field names are valid
  lines.push(`/** Valid field names for the "${form.name}" form */`);
  if (fields.length === 0) {
    lines.push(`export type ${fieldsTypeName} = never;`);
  } else {
    lines.push(`export type ${fieldsTypeName} =`);
    for (let i = 0; i < fields.length; i++) {
      const separator = i === fields.length - 1 ? ';' : '';
      lines.push(`  | "${fields[i]!.logicalName}"${separator}`);
    }
  }
  lines.push('');

  // 2. Attribute Map: maps field name to Xrm.Attributes.* type
  lines.push(`/** Attribute type map for "${form.name}" */`);
  if (fields.length === 0) {
    lines.push(`export type ${attrMapName} = Record<string, never>;`);
  } else {
    lines.push(`export type ${attrMapName} = {`);
    for (const field of fields) {
      lines.push(`  ${field.logicalName}: ${field.formAttributeType};`);
    }
    lines.push('};');
  }
  lines.push('');

  // 3. Control Map: maps field name to Xrm.Controls.* type
  lines.push(`/** Control type map for "${form.name}" */`);
  if (fields.length === 0) {
    lines.push(`export type ${ctrlMapName} = Record<string, never>;`);
  } else {
    lines.push(`export type ${ctrlMapName} = {`);
    for (const field of fields) {
      lines.push(`  ${field.logicalName}: ${field.formControlType};`);
    }
    lines.push('};');
  }
  lines.push('');

  // 4. Fields const enum: autocomplete with dual-language labels
  lines.push(`/** Field constants for "${form.name}" (compile-time only, zero runtime) */`);
  lines.push(`export const enum ${fieldsTypeName}Enum {`);
  for (const field of fields) {
    if (field.label) {
      lines.push(`  /** ${field.label} */`);
    }
    lines.push(`  ${field.enumMemberName} = ${singleQuoted(field.logicalName)},`);
  }
  lines.push('}');
  lines.push('');

  // 4b. Tabs const enum
  const namedTabs = form.tabs.filter((t) => t.name);
  if (namedTabs.length > 0) {
    const tabsEnumName = `${baseName}FormTabs`;

    // Pre-compute disambiguated tab member names (Bug 2 fix: duplicate tab names)
    const usedTabMembers = new Set<string>();
    const tabMemberNames: string[] = [];
    for (const tab of namedTabs) {
      let memberName = toSafeFormName(tab.name) || toPascalCase(tab.name);
      const originalName = memberName;
      let counter = 2;
      while (usedTabMembers.has(memberName)) {
        memberName = `${originalName}${counter}`;
        counter++;
      }
      usedTabMembers.add(memberName);
      tabMemberNames.push(memberName);
    }

    lines.push(`/** Tab constants for "${form.name}" (compile-time only, zero runtime) */`);
    lines.push(`export const enum ${tabsEnumName} {`);
    for (let i = 0; i < namedTabs.length; i++) {
      const tab = namedTabs[i]!;
      if (tab.label) {
        lines.push(`  /** ${tab.label} */`);
      }
      lines.push(`  ${tabMemberNames[i]} = ${singleQuoted(tab.name)},`);
    }
    lines.push('}');
    lines.push('');

    // 4c. Section const enums (one per tab, using disambiguated tab member names)
    for (let i = 0; i < namedTabs.length; i++) {
      const tab = namedTabs[i]!;
      const namedSections = tab.sections.filter((s) => s.name);
      if (namedSections.length === 0) continue;

      const tabMemberName = tabMemberNames[i]!;
      const sectionsEnumName = `${baseName}Form${tabMemberName}Sections`;
      lines.push(`/** Section constants for tab "${tab.name}" (compile-time only, zero runtime) */`);
      lines.push(`export const enum ${sectionsEnumName} {`);

      // Disambiguate section member names within a tab
      const usedSectionMembers = new Set<string>();
      for (const section of namedSections) {
        if (section.label) {
          lines.push(`  /** ${section.label} */`);
        }
        let sectionMember = toSafeFormName(section.name) || toPascalCase(section.name);
        const originalSectionMember = sectionMember;
        let sCounter = 2;
        while (usedSectionMembers.has(sectionMember)) {
          sectionMember = `${originalSectionMember}${sCounter}`;
          sCounter++;
        }
        usedSectionMembers.add(sectionMember);
        lines.push(`  ${sectionMember} = ${singleQuoted(section.name)},`);
      }
      lines.push('}');
      lines.push('');
    }
  }

  // 4d. Subgrid/QuickView const enum (all special controls with stable IDs)
  const specialControls = form.allSpecialControls || [];
  const subgrids = specialControls.filter((sc) => sc.controlType === 'subgrid' || sc.controlType === 'editablegrid');
  const quickViews = specialControls.filter((sc) => sc.controlType === 'quickview');

  if (subgrids.length > 0) {
    const subgridsEnumName = `${baseName}FormSubgrids`;
    lines.push(`/** Subgrid constants for "${form.name}" (compile-time only, zero runtime) */`);
    lines.push(`export const enum ${subgridsEnumName} {`);
    const usedMembers = new Set<string>();
    for (const sg of subgrids) {
      let member = toSafeFormName(sg.id) || toPascalCase(sg.id);
      const original = member;
      let counter = 2;
      while (usedMembers.has(member)) {
        member = `${original}${counter}`;
        counter++;
      }
      usedMembers.add(member);
      const label = sg.targetEntityType ? `Subgrid: ${sg.targetEntityType}` : `Subgrid`;
      lines.push(`  /** ${label} */`);
      lines.push(`  ${member} = ${singleQuoted(sg.id)},`);
    }
    lines.push('}');
    lines.push('');
  }

  if (quickViews.length > 0) {
    const qvEnumName = `${baseName}FormQuickViews`;
    lines.push(`/** Quick View constants for "${form.name}" (compile-time only, zero runtime) */`);
    lines.push(`export const enum ${qvEnumName} {`);
    const usedMembers = new Set<string>();
    for (const qv of quickViews) {
      let member = toSafeFormName(qv.id) || toPascalCase(qv.id);
      const original = member;
      let counter = 2;
      while (usedMembers.has(member)) {
        member = `${original}${counter}`;
        counter++;
      }
      usedMembers.add(member);
      lines.push(`  /** Quick View */`);
      lines.push(`  ${member} = ${singleQuoted(qv.id)},`);
    }
    lines.push('}');
    lines.push('');
  }

  // 5. Form Interface: generic getAttribute/getControl with compile-time validation
  lines.push(`/** ${form.name} */`);
  lines.push(`export interface ${interfaceName} extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'> {`);
  lines.push(`  /** Typisierter Feldzugriff: nur Felder die auf diesem Formular existieren */`);
  lines.push(`  getAttribute<K extends ${fieldsTypeName}>(name: K): ${attrMapName}[K];`);
  lines.push('  getAttribute(index: number): Xrm.Attributes.Attribute;');
  lines.push('  getAttribute(): Xrm.Attributes.Attribute[];');
  lines.push('');
  lines.push(`  /** Typisierter Control-Zugriff: nur Controls die auf diesem Formular existieren */`);
  lines.push(`  getControl<K extends ${fieldsTypeName}>(name: K): ${ctrlMapName}[K];`);

  // Typed getControl overloads for special controls (subgrids, quick views, etc.)
  for (const sc of specialControls) {
    const xrmType = specialControlToXrmType(sc.controlType);
    if (xrmType) {
      lines.push(`  getControl(name: "${sc.id}"): ${xrmType};`);
    }
  }

  lines.push('  getControl(index: number): Xrm.Controls.Control;');
  lines.push('  getControl(): Xrm.Controls.Control[];');

  // 6. Typed ui.tabs for compile-time tab name validation
  if (form.tabs.length > 0) {
    lines.push('');
    lines.push('  /** Typisierter Tab-Zugriff */');
    lines.push('  ui: {');
    lines.push('    tabs: {');
    for (const tab of form.tabs) {
      if (tab.name) {
        const sectionNames = tab.sections.filter((s) => s.name).map((s) => s.name);
        if (sectionNames.length > 0) {
          // Tab with typed sections
          lines.push(`      get(name: "${tab.name}"): Xrm.Controls.Tab & {`);
          lines.push('        sections: {');
          for (const sectionName of sectionNames) {
            lines.push(`          get(name: "${sectionName}"): Xrm.Controls.Section;`);
          }
          lines.push('          get(name: string): Xrm.Controls.Section;');
          lines.push('        };');
          lines.push('      };');
        } else {
          lines.push(`      get(name: "${tab.name}"): Xrm.Controls.Tab;`);
        }
      }
    }
    lines.push('      get(name: string): Xrm.Controls.Tab;');
    lines.push('    };');
    lines.push('  } & Xrm.Ui;');
  }

  lines.push('}');

  // 7. MockValues type for @xrmforge/testing
  const mockValuesName = `${interfaceName}MockValues`;
  lines.push('');
  lines.push(`/** Mock value types for "${form.name}" form (used with @xrmforge/testing) */`);
  lines.push(`export type ${mockValuesName} = {`);
  for (const field of fields) {
    const mockType = getFormMockValueType(field.attributeType);
    lines.push(`  ${field.logicalName}?: ${mockType};`);
  }
  lines.push('};');
  lines.push('');

  // 8. FormTypeInfo for typedForm() (bundles Fields, AttrMap, CtrlMap for type-safe proxy)
  lines.push(`/** Type info for typedForm<${interfaceName}>(). Bundles Fields, AttributeMap, ControlMap. */`);
  lines.push(`export interface ${interfaceName}TypeInfo {`);
  lines.push(`  fields: ${fieldsTypeName};`);
  lines.push(`  attributes: ${attrMapName};`);
  lines.push(`  controls: ${ctrlMapName};`);
  lines.push(`  form: ${interfaceName};`);
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

  const entityPascal = toPascalCase(entityLogicalName);

  // Pre-compute base names for all valid forms. Quick Create forms (type 7) get a
  // "QuickCreate" suffix so they never collide with the same-named Main form
  // (Main "Account" -> AccountForm, Quick Create "Account" -> AccountQuickCreateForm).
  // The suffix is applied BEFORE duplicate disambiguation, so two same-named Quick
  // Create forms still get the numeric suffix (AccountQuickCreate, AccountQuickCreate2).
  const validForms = forms.filter((f) => f.allControls.length > 0);
  const baseNames = validForms.map((form) => {
    const base = buildFormBaseName(entityPascal, toSafeFormName(form.name));
    return form.type === FORM_TYPE_QUICK_CREATE ? `${base}QuickCreate` : base;
  });

  // Count occurrences to detect duplicates
  const baseNameCounts = new Map<string, number>();
  for (const name of baseNames) {
    baseNameCounts.set(name, (baseNameCounts.get(name) || 0) + 1);
  }

  // Disambiguate duplicate base names with numeric suffix
  const baseNameCounters = new Map<string, number>();
  const results: Array<{ formName: string; interfaceName: string; content: string }> = [];

  for (let i = 0; i < validForms.length; i++) {
    const form = validForms[i]!;
    let baseName = baseNames[i]!;

    if (baseNameCounts.get(baseName)! > 1) {
      const counter = (baseNameCounters.get(baseName) || 0) + 1;
      baseNameCounters.set(baseName, counter);
      if (counter > 1) {
        baseName = `${baseName}${counter}`;
      }
    }

    const interfaceName = `${baseName}Form`;
    const content = generateFormInterface(form, entityLogicalName, attributeMap, options, baseName);
    results.push({ formName: form.name, interfaceName, content });
  }

  return results;
}
