/**
 * @xrmforge/typegen - Label Utilities
 *
 * Extracts and formats labels from Dataverse metadata for use in
 * generated TypeScript code (JSDoc comments, enum member names).
 *
 * Supports dual-language labels (Goldene Regel 15):
 * - Primary language (default 1033/English): used for identifiers
 * - Secondary language (optional, e.g. 1031/German): appended in JSDoc
 */

import type { Label } from '../metadata/types.js';

/** Configuration for label extraction */
export interface LabelConfig {
  /** Primary language code (default: 1033 = English) */
  primaryLanguage: number;
  /** Optional secondary language code (e.g. 1031 = German) */
  secondaryLanguage?: number;
}

/** Default label configuration */
export const DEFAULT_LABEL_CONFIG: LabelConfig = {
  primaryLanguage: 1033,
};

/**
 * Extract the label text for the primary language from a Label structure.
 * Falls back to UserLocalizedLabel, then first available label.
 */
export function getPrimaryLabel(label: Label, config: LabelConfig = DEFAULT_LABEL_CONFIG): string {
  // Try primary language
  const primary = label.LocalizedLabels.find((l) => l.LanguageCode === config.primaryLanguage);
  if (primary && primary.Label) return primary.Label;

  // Fallback: UserLocalizedLabel
  if (label.UserLocalizedLabel && label.UserLocalizedLabel.Label) return label.UserLocalizedLabel.Label;

  // Fallback: first available
  const first = label.LocalizedLabels[0];
  if (label.LocalizedLabels.length > 0 && first && first.Label) {
    return first.Label;
  }

  return '';
}

/**
 * Extract the secondary language label, if configured and available.
 * Returns undefined if no secondary language is configured or label not found.
 */
export function getSecondaryLabel(label: Label, config: LabelConfig = DEFAULT_LABEL_CONFIG): string | undefined {
  if (!config.secondaryLanguage) return undefined;

  const secondary = label.LocalizedLabels.find((l) => l.LanguageCode === config.secondaryLanguage);
  return (secondary && secondary.Label) || undefined;
}

/**
 * Format a JSDoc comment with optional dual-language label.
 * Returns "Primary Label | Sekundäres Label" if both available,
 * otherwise just the primary label.
 */
export function formatDualLabel(label: Label, config: LabelConfig = DEFAULT_LABEL_CONFIG): string {
  const primary = getPrimaryLabel(label, config);
  const secondary = getSecondaryLabel(label, config);

  if (!primary) return '';
  if (secondary && secondary !== primary) return `${primary} | ${secondary}`;
  return primary;
}

/**
 * Convert a label to a valid PascalCase TypeScript identifier for enum members.
 * Removes invalid characters, handles edge cases.
 *
 * @example
 * labelToEnumMember("Preferred Customer") // "PreferredCustomer"
 * labelToEnumMember("100% Complete") // "_100Complete"
 * labelToEnumMember("") // "" (caller handles empty)
 */
export function labelToEnumMember(labelText: string): string {
  if (!labelText) return '';

  // Remove characters that are not letters, digits, or spaces/underscores
  let cleaned = labelText.replace(/[^a-zA-Z0-9\s_]/g, '');

  // Split on whitespace/underscore and PascalCase each word
  const parts = cleaned.split(/[\s_]+/).filter((p) => p.length > 0);
  if (parts.length === 0) return '';

  const pascal = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');

  // Ensure it doesn't start with a digit
  if (/^\d/.test(pascal)) {
    return `_${pascal}`;
  }

  return pascal;
}

/**
 * Disambiguate duplicate enum member names by appending the numeric value.
 * Only the second and subsequent duplicates get the suffix.
 *
 * @param members - Array of { name, value } pairs (name may have duplicates)
 * @returns Array with disambiguated names
 *
 * @example
 * disambiguateEnumMembers([
 *   { name: "Active", value: 1 },
 *   { name: "Active", value: 2 },
 *   { name: "Inactive", value: 3 },
 * ])
 * // Returns: [
 * //   { name: "Active", value: 1 },
 * //   { name: "Active_2", value: 2 },
 * //   { name: "Inactive", value: 3 },
 * // ]
 */
export function disambiguateEnumMembers(
  members: Array<{ name: string; value: number }>,
): Array<{ name: string; value: number }> {
  const seen = new Map<string, number>(); // name -> count
  return members.map(({ name, value }) => {
    const count = seen.get(name) || 0;
    seen.set(name, count + 1);

    if (count === 0) {
      return { name, value };
    }
    // Disambiguate: append _value
    return { name: `${name}_${value}`, value };
  });
}
