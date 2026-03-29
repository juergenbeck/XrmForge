/**
 * @xrmforge/typegen - FormXml Parser
 *
 * Parses Dataverse FormXml into structured TypeScript objects.
 * Extracts tabs, sections, and controls for generating typed FormContext interfaces.
 *
 * Uses the XmlParser abstraction (Goldene Regel 14) instead of regex,
 * because enterprise FormXml can contain PCF controls with freeform
 * xs:any parameters, variable attribute ordering, and 8-10 nesting levels.
 */

import type { FormControl, FormTab, FormSection, ParsedForm, SystemFormMetadata } from './types.js';
import type { XmlParser, XmlElement } from './xml-parser.js';
import { defaultXmlParser } from './xml-parser.js';
import { MetadataError, ErrorCode } from '../errors.js';
import { createLogger } from '../logger.js';

const log = createLogger('form-parser');

/**
 * Parse a SystemFormMetadata response into a structured ParsedForm.
 *
 * @param form - The system form metadata from the API
 * @param parser - XML parser to use (defaults to fast-xml-parser)
 * @throws {MetadataError} if the formxml cannot be parsed
 */
export function parseForm(form: SystemFormMetadata, parser: XmlParser = defaultXmlParser): ParsedForm {
  const tabs = parseTabs(form.formxml, form.name, parser);
  const allControls = tabs.flatMap((tab) =>
    tab.sections.flatMap((section) => section.controls),
  );

  return {
    name: form.name,
    formId: form.formid,
    isDefault: form.isdefault,
    tabs,
    allControls,
  };
}

/**
 * Extract all data-bound control field names from FormXml (flattened).
 * Simpler alternative to full parsing when only the field list is needed.
 *
 * @param formxml - The raw FormXml string
 * @param parser - XML parser to use (defaults to fast-xml-parser)
 */
export function extractControlFields(formxml: string, parser: XmlParser = defaultXmlParser): string[] {
  if (!formxml || formxml.trim().length === 0) {
    return [];
  }

  try {
    const root = parser.parse(formxml);
    const fields: string[] = [];
    collectDatafieldNames(root, fields);
    return fields;
  } catch {
    log.warn('Failed to parse formxml for field extraction, returning empty list');
    return [];
  }
}

// ─── Internal Parsing ────────────────────────────────────────────────────────

function parseTabs(formxml: string, formName: string, parser: XmlParser): FormTab[] {
  if (!formxml || formxml.trim().length === 0) {
    log.warn(`Empty formxml for form "${formName}"`);
    return [];
  }

  let root: XmlElement;
  try {
    root = parser.parse(formxml);
  } catch (error: unknown) {
    throw new MetadataError(
      ErrorCode.META_FORM_PARSE_FAILED,
      `Failed to parse FormXml for form "${formName}"`,
      {
        formName,
        originalError: error instanceof Error ? error.message : String(error),
      },
    );
  }

  const tabs: FormTab[] = [];
  const tabElements = findElements(root, 'tab');

  for (const tabEl of tabElements) {
    const tabName = tabEl.attributes['name'] ?? '';
    const sections = parseSections(tabEl);
    tabs.push({ name: tabName, sections });
  }

  return tabs;
}

function parseSections(tabElement: XmlElement): FormSection[] {
  const sections: FormSection[] = [];
  const sectionElements = findElements(tabElement, 'section');

  for (const sectionEl of sectionElements) {
    const sectionName = sectionEl.attributes['name'] ?? '';
    const controls = parseControls(sectionEl);
    sections.push({ name: sectionName, controls });
  }

  return sections;
}

function parseControls(sectionElement: XmlElement): FormControl[] {
  const controls: FormControl[] = [];
  const controlElements = findElements(sectionElement, 'control');

  for (const controlEl of controlElements) {
    const datafieldname = controlEl.attributes['datafieldname'];
    if (!datafieldname) continue; // Skip controls without data binding (subgrids, web resources, etc.)

    controls.push({
      id: controlEl.attributes['id'] ?? '',
      datafieldname,
      classid: controlEl.attributes['classid'] ?? '',
    });
  }

  return controls;
}

// ─── XML Tree Navigation ─────────────────────────────────────────────────────

/**
 * Recursively find all elements with a given tag name.
 */
function findElements(element: XmlElement, tagName: string): XmlElement[] {
  const results: XmlElement[] = [];

  if (element.tag === tagName) {
    results.push(element);
  }

  for (const child of element.children) {
    results.push(...findElements(child, tagName));
  }

  return results;
}

/**
 * Recursively collect all datafieldname attributes from control elements.
 */
function collectDatafieldNames(element: XmlElement, fields: string[]): void {
  if (element.tag === 'control') {
    const name = element.attributes['datafieldname'];
    if (name && !fields.includes(name)) {
      fields.push(name);
    }
  }

  for (const child of element.children) {
    collectDatafieldNames(child, fields);
  }
}
