/**
 * @xrmforge/typegen - Generator-specific Label Utilities
 *
 * This module contains ONLY generator-specific label functions.
 * Core label extraction (getPrimaryLabel, getJSDocLabel, LabelConfig etc.)
 * is provided by the canonical implementation in metadata/labels.ts (R6-02).
 *
 * Re-exports from metadata/labels.ts are provided for convenience.
 */

// Re-export canonical label utilities from metadata/labels.ts
export {
  getPrimaryLabel,
  getJSDocLabel as formatDualLabel,
  labelToIdentifier,
  transliterateUmlauts,
  DEFAULT_LABEL_CONFIG,
} from '../metadata/labels.js';
export type { LabelConfig } from '../metadata/labels.js';

// Re-export getSecondaryLabel functionality via getJSDocLabel
// (getSecondaryLabel was a generator-only concept, not needed separately)

import type { Label } from '../metadata/types.js';
import type { LabelConfig } from '../metadata/labels.js';

/**
 * Extract the secondary language label, if configured and available.
 * Returns undefined if no secondary language is configured or label not found.
 */
export function getSecondaryLabel(label: Label, config: LabelConfig): string | undefined {
  if (!config.secondaryLanguage) return undefined;

  const secondary = label.LocalizedLabels.find((l) => l.LanguageCode === config.secondaryLanguage);
  return (secondary && secondary.Label) || undefined;
}

// ─── Generator-specific: Enum Member Names ──────────────────────────────────

import { transliterateUmlauts } from '../metadata/labels.js';

/**
 * Convert a label to a valid PascalCase TypeScript identifier for enum members.
 * Transliterates German umlauts (R6-03), then removes remaining invalid characters.
 *
 * @example
 * labelToEnumMember("Preferred Customer") // "PreferredCustomer"
 * labelToEnumMember("Bevorzügter Kunde")  // "BevorzuegterKunde"
 * labelToEnumMember("100% Complete")      // "_100Complete"
 * labelToEnumMember("")                   // "" (caller handles empty)
 */
export function labelToEnumMember(labelText: string): string {
  if (!labelText) return '';

  // Transliterate umlauts first (ä -> ae, ö -> oe, etc.)
  const transliterated = transliterateUmlauts(labelText);

  // Remove characters that are not ASCII letters, digits, spaces or underscores
  const cleaned = transliterated.replace(/[^a-zA-Z0-9\s_]/g, '');

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

// ─── Generator-specific: Disambiguate Duplicate Enum Members ─────────────────

/**
 * Disambiguate duplicate enum member names by appending the numeric value.
 * Only the second and subsequent duplicates get the suffix.
 *
 * @example
 * disambiguateEnumMembers([
 *   { name: "Active", value: 1 },
 *   { name: "Active", value: 2 },
 * ])
 * // [{ name: "Active", value: 1 }, { name: "Active_2", value: 2 }]
 */
export function disambiguateEnumMembers(
  members: Array<{ name: string; value: number }>,
): Array<{ name: string; value: number }> {
  const seen = new Map<string, number>();
  return members.map(({ name, value }) => {
    const count = seen.get(name) || 0;
    seen.set(name, count + 1);

    if (count === 0) {
      return { name, value };
    }
    return { name: `${name}_${value}`, value };
  });
}
