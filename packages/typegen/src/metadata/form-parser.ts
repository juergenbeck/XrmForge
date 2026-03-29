/**
 * @xrmforge/typegen - FormXml Parser
 *
 * Parses Dataverse FormXml (XML string) into structured TypeScript objects.
 * Extracts tabs, sections, and controls that are relevant for generating
 * typed FormContext interfaces.
 *
 * Uses regex-based parsing instead of a full XML parser to avoid
 * additional dependencies. FormXml has a predictable structure.
 */

import type { FormControl, FormTab, FormSection, ParsedForm, SystemFormMetadata } from './types.js';
import { MetadataError, ErrorCode } from '../errors.js';
import { createLogger } from '../logger.js';

const log = createLogger('form-parser');

/**
 * Parse a SystemFormMetadata response into a structured ParsedForm.
 *
 * @throws {MetadataError} if the formxml cannot be parsed
 */
export function parseForm(form: SystemFormMetadata): ParsedForm {
  const tabs = parseTabs(form.formxml, form.name);
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
 * Extract all data-bound controls from FormXml (flattened, ignoring structure).
 * This is a simpler alternative to full parsing when only the field list is needed.
 */
export function extractControlFields(formxml: string): string[] {
  const fields: string[] = [];
  const controlRegex = /<control[^>]+datafieldname="([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = controlRegex.exec(formxml)) !== null) {
    const fieldName = match[1];
    if (fieldName && !fields.includes(fieldName)) {
      fields.push(fieldName);
    }
  }

  return fields;
}

// ─── Internal Parsing ────────────────────────────────────────────────────────

function parseTabs(formxml: string, formName: string): FormTab[] {
  if (!formxml || formxml.trim().length === 0) {
    log.warn(`Empty formxml for form "${formName}"`);
    return [];
  }

  const tabs: FormTab[] = [];

  // Match <tab ...>...</tab> blocks (non-greedy, handles nested content)
  const tabRegex = /<tab\s+[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/tab>/g;
  let tabMatch: RegExpExecArray | null;

  while ((tabMatch = tabRegex.exec(formxml)) !== null) {
    const tabName = tabMatch[1] ?? '';
    const tabContent = tabMatch[2] ?? '';

    try {
      const sections = parseSections(tabContent);
      tabs.push({ name: tabName, sections });
    } catch (error: unknown) {
      throw new MetadataError(
        ErrorCode.META_FORM_PARSE_FAILED,
        `Failed to parse tab "${tabName}" in form "${formName}"`,
        {
          formName,
          tabName,
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  return tabs;
}

function parseSections(tabContent: string): FormSection[] {
  const sections: FormSection[] = [];

  const sectionRegex = /<section\s+[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/section>/g;
  let sectionMatch: RegExpExecArray | null;

  while ((sectionMatch = sectionRegex.exec(tabContent)) !== null) {
    const sectionName = sectionMatch[1] ?? '';
    const sectionContent = sectionMatch[2] ?? '';
    const controls = parseControls(sectionContent);
    sections.push({ name: sectionName, controls });
  }

  return sections;
}

function parseControls(sectionContent: string): FormControl[] {
  const controls: FormControl[] = [];

  const controlRegex = /<control\s+[^>]*id="([^"]*)"[^>]*classid="([^"]*)"[^>]*datafieldname="([^"]*)"[^>]*\/?\s*>/g;
  let controlMatch: RegExpExecArray | null;

  while ((controlMatch = controlRegex.exec(sectionContent)) !== null) {
    const id = controlMatch[1] ?? '';
    const classid = controlMatch[2] ?? '';
    const datafieldname = controlMatch[3] ?? '';

    if (datafieldname) {
      controls.push({ id, datafieldname, classid });
    }
  }

  // Also try alternate attribute order (datafieldname before classid)
  const altRegex = /<control\s+[^>]*datafieldname="([^"]*)"[^>]*id="([^"]*)"[^>]*classid="([^"]*)"[^>]*\/?\s*>/g;
  let altMatch: RegExpExecArray | null;

  while ((altMatch = altRegex.exec(sectionContent)) !== null) {
    const datafieldname = altMatch[1] ?? '';
    const id = altMatch[2] ?? '';
    const classid = altMatch[3] ?? '';

    if (datafieldname && !controls.some((c) => c.datafieldname === datafieldname)) {
      controls.push({ id, datafieldname, classid });
    }
  }

  return controls;
}
