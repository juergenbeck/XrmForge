/**
 * @xrmforge/typegen - Label Utilities
 *
 * Extracts and formats localized labels from Dataverse metadata.
 * Supports dual-language output (Goldene Regel 15):
 * - Primary language for identifiers and first JSDoc line
 * - Secondary language as optional addition in JSDoc
 *
 * Format: "Primary Label | Sekundäres Label"
 * If secondary language is not available: "Primary Label" only.
 */

import type { Label, LocalizedLabel } from './types.js';

// ─── Configuration ───────────────────────────────────────────────────────────

export interface LabelConfig {
  /** Primary language LCID (used for identifiers and first JSDoc line). Default: 1033 (English) */
  primaryLanguage: number;
  /** Optional secondary language LCID (added as comment). Example: 1031 (German) */
  secondaryLanguage?: number;
}

/** Default: English only */
export const DEFAULT_LABEL_CONFIG: LabelConfig = {
  primaryLanguage: 1033,
};

// ─── Label Extraction ────────────────────────────────────────────────────────

/**
 * Extract a label string for the primary language.
 * Falls back to UserLocalizedLabel if the specific LCID is not found.
 * Returns empty string if no label is available.
 */
export function getPrimaryLabel(label: Label | null | undefined, config: LabelConfig): string {
  if (!label) return '';
  return getLabelForLanguage(label, config.primaryLanguage);
}

/**
 * Extract a dual-language JSDoc string.
 * Returns "Primary | Secondary" if both languages available,
 * or just "Primary" if secondary is missing or not configured.
 */
export function getJSDocLabel(label: Label | null | undefined, config: LabelConfig): string {
  if (!label) return '';

  const primary = getLabelForLanguage(label, config.primaryLanguage);
  if (!primary) return '';

  if (!config.secondaryLanguage) return primary;

  const secondary = getLabelForLanguage(label, config.secondaryLanguage);
  if (!secondary || secondary === primary) return primary;

  return `${primary} | ${secondary}`;
}

/**
 * Extract a label for a specific language code.
 * Searches LocalizedLabels first, falls back to UserLocalizedLabel.
 */
function getLabelForLanguage(label: Label, languageCode: number): string {
  // Search in LocalizedLabels array first (most precise)
  const localized = label.LocalizedLabels?.find(
    (l: LocalizedLabel) => l.LanguageCode === languageCode,
  );
  if (localized?.Label) return localized.Label;

  // Fall back to UserLocalizedLabel
  if (label.UserLocalizedLabel?.Label) return label.UserLocalizedLabel.Label;

  return '';
}

// ─── Identifier Generation ───────────────────────────────────────────────────

/**
 * Convert a label string to a valid TypeScript identifier (PascalCase).
 * Removes invalid characters, handles edge cases.
 *
 * @returns A valid TypeScript identifier, or null if the label cannot be converted
 */
export function labelToIdentifier(label: string): string | null {
  if (!label || label.trim().length === 0) return null;

  // Remove characters that are not letters, digits, spaces, or underscores
  let cleaned = label.replace(/[^a-zA-Z0-9\s_\u00C0-\u024F]/g, '');
  cleaned = cleaned.trim();

  if (cleaned.length === 0) return null;

  // Convert to PascalCase: split by spaces/underscores, capitalize first letter of each word
  const parts = cleaned.split(/[\s_]+/).filter((p) => p.length > 0);
  const pascal = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  if (pascal.length === 0) return null;

  // Ensure it starts with a letter (not a digit)
  if (/^\d/.test(pascal)) {
    return `_${pascal}`;
  }

  return pascal;
}

/**
 * Generate unique enum member names from OptionSet labels.
 * Handles duplicates by appending _{Value} to colliding names.
 * Falls back to Value_{numericValue} for unconvertible labels.
 *
 * @param options - Array of { Value, Label } from OptionSetMetadata
 * @param config - Label configuration for language selection
 * @returns Array of { name, value, jsDocLabel } for enum generation
 */
export function generateEnumMembers(
  options: Array<{ Value: number; Label: Label }>,
  config: LabelConfig,
): Array<{ name: string; value: number; jsDocLabel: string }> {
  // Step 1: Generate initial names from labels
  const members = options.map((option) => {
    const primaryLabel = getPrimaryLabel(option.Label, config);
    const identifier = labelToIdentifier(primaryLabel);
    const jsDocLabel = getJSDocLabel(option.Label, config);

    return {
      rawName: identifier ?? `Value_${option.Value}`,
      value: option.Value,
      jsDocLabel: jsDocLabel || `Value ${option.Value}`,
      fromLabel: identifier !== null,
    };
  });

  // Step 2: Detect duplicates and disambiguate
  const nameCount = new Map<string, number>();
  for (const m of members) {
    nameCount.set(m.rawName, (nameCount.get(m.rawName) ?? 0) + 1);
  }

  const nameUsed = new Map<string, boolean>();
  const result: Array<{ name: string; value: number; jsDocLabel: string }> = [];

  for (const m of members) {
    const count = nameCount.get(m.rawName) ?? 1;

    if (count === 1) {
      // Unique name, use as-is
      result.push({ name: m.rawName, value: m.value, jsDocLabel: m.jsDocLabel });
    } else {
      // Duplicate: first occurrence keeps the name, subsequent get _{Value}
      if (!nameUsed.get(m.rawName)) {
        nameUsed.set(m.rawName, true);
        result.push({ name: m.rawName, value: m.value, jsDocLabel: m.jsDocLabel });
      } else {
        result.push({ name: `${m.rawName}_${m.value}`, value: m.value, jsDocLabel: m.jsDocLabel });
      }
    }
  }

  return result;
}

// ─── Query Parameter ─────────────────────────────────────────────────────────

/**
 * Build the LabelLanguages query parameter for Dataverse Metadata API.
 * Returns the parameter string to append to metadata queries.
 *
 * @example
 * getLabelLanguagesParam({ primaryLanguage: 1033, secondaryLanguage: 1031 })
 * // Returns "&LabelLanguages=1033,1031"
 */
export function getLabelLanguagesParam(config: LabelConfig): string {
  const languages = [config.primaryLanguage];
  if (config.secondaryLanguage && config.secondaryLanguage !== config.primaryLanguage) {
    languages.push(config.secondaryLanguage);
  }
  return `&LabelLanguages=${languages.join(',')}`;
}
