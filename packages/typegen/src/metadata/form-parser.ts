/**
 * @xrmforge/typegen - FormXml Parser
 *
 * Parses Dataverse FormXml into structured TypeScript objects.
 * Extracts tabs, sections, controls (data-bound + special) for generating
 * typed FormContext interfaces with compile-time field validation.
 *
 * Uses the XmlParser abstraction (Goldene Regel 14) instead of regex.
 */

import type { FormControl, FormSpecialControl, FormTab, FormSection, ParsedForm, SystemFormMetadata, SpecialControlType } from './types.js';
import type { XmlParser, XmlElement } from './xml-parser.js';
import { defaultXmlParser } from './xml-parser.js';
import { MetadataError, ErrorCode } from '../errors.js';
import { createLogger } from '../logger.js';

const log = createLogger('form-parser');

// ─── Known Control ClassIds ─────────────────────────────────────────────────
// Extracted from real FormXml across 25 Markant entities (2026-03-30)

/** Well-known classid GUIDs for special (non-data-bound) controls */
const SPECIAL_CONTROL_CLASSIDS: Record<string, SpecialControlType> = {
  // Subgrid (read-only list of related records)
  'e7a81278-8635-4d9e-8d4d-59480b391c5b': 'subgrid',
  // Editable Grid (inline-editable list)
  '02d4264b-47e2-4b4c-aa95-f439f3f4d458': 'editablegrid',
  // Quick View Form (embedded read-only form of related record)
  '5c5600e0-1d6e-4205-a272-be80da87fd42': 'quickview',
  // Web Resource (custom HTML/JS content)
  '9fdf5f91-88b1-47f4-ad53-c11efc01a01d': 'webresource',
  // Bing Map
  '62b0df79-0464-470f-8af7-4483cfea0c7d': 'map',
  // Notes/Timeline
  '06375649-c143-495e-a496-c962e5b4488e': 'notes',
};

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
  const allSpecialControls = tabs.flatMap((tab) =>
    tab.sections.flatMap((section) => section.specialControls),
  );

  return {
    name: form.name,
    formId: form.formid,
    isDefault: form.isdefault,
    tabs,
    allControls,
    allSpecialControls,
  };
}

/**
 * Extract all data-bound control field names from FormXml (flattened).
 * Simpler alternative to full parsing when only the field list is needed.
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
    const tabVisible = tabEl.attributes['visible'] !== 'false';

    // Extract tab label from <labels><label description="..." /></labels>
    const tabLabel = extractLabel(tabEl);

    const sections = parseSections(tabEl);
    tabs.push({ name: tabName, label: tabLabel, visible: tabVisible, sections });
  }

  return tabs;
}

function parseSections(tabElement: XmlElement): FormSection[] {
  const sections: FormSection[] = [];
  const sectionElements = findElements(tabElement, 'section');

  for (const sectionEl of sectionElements) {
    const sectionName = sectionEl.attributes['name'] ?? '';
    const sectionVisible = sectionEl.attributes['visible'] !== 'false';
    const sectionLabel = extractLabel(sectionEl);

    const controls = parseDataControls(sectionEl);
    const specialControls = parseSpecialControls(sectionEl);

    sections.push({
      name: sectionName,
      label: sectionLabel,
      visible: sectionVisible,
      controls,
      specialControls,
    });
  }

  return sections;
}

/** Parse data-bound controls (controls with a datafieldname attribute) */
function parseDataControls(sectionElement: XmlElement): FormControl[] {
  const controls: FormControl[] = [];
  const controlElements = findElements(sectionElement, 'control');

  for (const controlEl of controlElements) {
    const datafieldname = controlEl.attributes['datafieldname'];
    if (!datafieldname) continue; // Special controls are handled separately

    controls.push({
      id: controlEl.attributes['id'] ?? '',
      datafieldname,
      classid: controlEl.attributes['classid'] ?? '',
    });
  }

  return controls;
}

/** Parse special controls (subgrids, quick views, web resources, etc.) */
function parseSpecialControls(sectionElement: XmlElement): FormSpecialControl[] {
  const controls: FormSpecialControl[] = [];
  const controlElements = findElements(sectionElement, 'control');

  for (const controlEl of controlElements) {
    // Only process controls WITHOUT datafieldname (these are special controls)
    if (controlEl.attributes['datafieldname']) continue;

    const classid = (controlEl.attributes['classid'] ?? '').replace(/[{}]/g, '').toLowerCase();
    const controlType = SPECIAL_CONTROL_CLASSIDS[classid];

    // Skip controls we don't recognize (standard field controls without datafieldname are noise)
    if (!controlType) continue;

    const special: FormSpecialControl = {
      id: controlEl.attributes['id'] ?? '',
      classid,
      controlType,
    };

    // Extract parameters for subgrids and quick views
    if (controlType === 'subgrid' || controlType === 'editablegrid') {
      special.targetEntityType = extractParameter(controlEl, 'TargetEntityType');
      special.relationshipName = extractParameter(controlEl, 'RelationshipName');
    }

    if (controlType === 'webresource') {
      special.webResourceName = extractParameter(controlEl, 'Url');
    }

    controls.push(special);
  }

  return controls;
}

// ─── XML Tree Navigation ─────────────────────────────────────────────────────

/** Recursively find all elements with a given tag name */
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

/** Recursively collect all datafieldname attributes from control elements */
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

/** Extract label text from a <labels><label description="..." /></labels> child */
function extractLabel(element: XmlElement): string | undefined {
  const labelsEl = element.children.find((c) => c.tag === 'labels');
  if (!labelsEl) return undefined;

  const labelEl = labelsEl.children.find((c) => c.tag === 'label');
  if (!labelEl) return undefined;

  return labelEl.attributes['description'] || undefined;
}

/** Extract a parameter value from <parameters><ParameterName>Value</ParameterName></parameters> */
function extractParameter(controlElement: XmlElement, paramName: string): string | undefined {
  const paramsEl = controlElement.children.find((c) => c.tag === 'parameters');
  if (!paramsEl) return undefined;

  const paramEl = paramsEl.children.find((c) => c.tag === paramName);
  if (!paramEl) return undefined;

  return paramEl.text || undefined;
}
