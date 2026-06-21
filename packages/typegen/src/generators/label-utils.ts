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
import { toSafeIdentifier, toPascalCase } from './type-mapping.js';

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

/**
 * Build the enum member name for an attribute from its SchemaName.
 *
 * Shared by the entity Fields enum, the NavigationProperties enum and the form
 * Fields enum so the three stay in lock-step (R46-07, no per-call-site drift).
 * The member is derived from the SchemaName (a valid identifier, unique per
 * entity), so it is deterministic, collision-free and guessable from the
 * LogicalName - the same scheme pac modelbuilder and XrmDefinitelyTyped use.
 * Falls back to a PascalCased LogicalName when the SchemaName is missing
 * (defensive; real metadata always provides one).
 *
 * `usedNames` carries state across the calls for one enum: on a (practically
 * impossible) collision the LogicalName is appended so the member stays
 * unambiguous without an order-dependent ordinal. The chosen name is added to
 * the set before returning.
 *
 * @example
 * const used = new Set<string>();
 * buildAttributeMemberName('markant_AFeedback_IsRated', 'markant_afeedback_israted', used);
 * // "markant_AFeedback_IsRated"
 * buildAttributeMemberName('', 'markant_foo', used); // "MarkantFoo" (SchemaName fallback)
 */
export function buildAttributeMemberName(
  schemaName: string | undefined,
  logicalName: string,
  usedNames: Set<string>,
): string {
  let member = (schemaName ? toSafeIdentifier(schemaName) : '') || toPascalCase(logicalName);
  while (usedNames.has(member)) {
    member = `${member}_${toSafeIdentifier(logicalName)}`;
  }
  usedNames.add(member);
  return member;
}

// ─── Generator-specific: Disambiguate Duplicate Enum Members ─────────────────

/**
 * Disambiguate duplicate enum member names by appending the numeric value.
 * Only the second and subsequent duplicates get the suffix.
 * Re-checks that the suffixed name doesn't collide with an existing name.
 *
 * @example
 * disambiguateEnumMembers([
 *   { name: "Active", value: 1 },
 *   { name: "Active", value: 2 },
 * ])
 * // [{ name: "Active", value: 1 }, { name: "Active_2", value: 2 }]
 *
 * // Edge case: "Active_2" already exists as a label-derived name
 * disambiguateEnumMembers([
 *   { name: "Active", value: 1 },
 *   { name: "Active", value: 2 },
 *   { name: "Active_2", value: 3 },
 * ])
 * // [{ name: "Active", value: 1 }, { name: "Active_2_v2", value: 2 }, { name: "Active_2", value: 3 }]
 */
export function disambiguateEnumMembers(
  members: Array<{ name: string; value: number }>,
): Array<{ name: string; value: number }> {
  // First pass: collect all original names to detect collisions
  const allOriginalNames = new Set(members.map((m) => m.name));
  const usedNames = new Set<string>();
  const result: Array<{ name: string; value: number }> = [];

  for (const { name, value } of members) {
    let finalName = name;

    if (usedNames.has(finalName)) {
      // Try _value suffix first
      finalName = `${name}_${value}`;

      // If that also collides (with an original name or already used), keep suffixing
      let attempt = 2;
      while (usedNames.has(finalName) || (allOriginalNames.has(finalName) && finalName !== name)) {
        finalName = `${name}_${value}_v${attempt}`;
        attempt++;
      }
    }

    usedNames.add(finalName);
    result.push({ name: finalName, value });
  }

  return result;
}
