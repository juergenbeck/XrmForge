import { describe, it, expect } from 'vitest';
import {
  getPrimaryLabel,
  getSecondaryLabel,
  formatDualLabel,
  labelToEnumMember,
  disambiguateEnumMembers,
} from '../src/generators/label-utils.js';
import type { Label } from '../src/metadata/types.js';
import type { LabelConfig } from '../src/generators/label-utils.js';

// ─── Helper ──────────────────────────────────────────────────────────────────

function createLabel(labels: Array<{ text: string; lang: number }>): Label {
  return {
    LocalizedLabels: labels.map((l) => ({ Label: l.text, LanguageCode: l.lang })),
    UserLocalizedLabel: labels.length > 0 ? { Label: labels[0].text, LanguageCode: labels[0].lang } : null,
  };
}

const EN_DE: LabelConfig = { primaryLanguage: 1033, secondaryLanguage: 1031 };
const EN_ONLY: LabelConfig = { primaryLanguage: 1033 };

// ─── getPrimaryLabel ─────────────────────────────────────────────────────────

describe('getPrimaryLabel', () => {
  it('should return primary language label', () => {
    const label = createLabel([
      { text: 'Account Name', lang: 1033 },
      { text: 'Firmenname', lang: 1031 },
    ]);
    expect(getPrimaryLabel(label, EN_ONLY)).toBe('Account Name');
  });

  it('should fallback to UserLocalizedLabel when primary language not found', () => {
    const label = createLabel([{ text: 'Firmenname', lang: 1031 }]);
    expect(getPrimaryLabel(label, EN_ONLY)).toBe('Firmenname');
  });

  it('should return empty string for empty labels', () => {
    const label: Label = { LocalizedLabels: [], UserLocalizedLabel: null };
    expect(getPrimaryLabel(label, EN_ONLY)).toBe('');
  });
});

// ─── getSecondaryLabel ───────────────────────────────────────────────────────

describe('getSecondaryLabel', () => {
  it('should return secondary language label when configured', () => {
    const label = createLabel([
      { text: 'Account Name', lang: 1033 },
      { text: 'Firmenname', lang: 1031 },
    ]);
    expect(getSecondaryLabel(label, EN_DE)).toBe('Firmenname');
  });

  it('should return undefined when no secondary language configured', () => {
    const label = createLabel([{ text: 'Account Name', lang: 1033 }]);
    expect(getSecondaryLabel(label, EN_ONLY)).toBeUndefined();
  });

  it('should return undefined when secondary language not found', () => {
    const label = createLabel([{ text: 'Account Name', lang: 1033 }]);
    expect(getSecondaryLabel(label, EN_DE)).toBeUndefined();
  });
});

// ─── formatDualLabel ─────────────────────────────────────────────────────────

describe('formatDualLabel', () => {
  it('should format with pipe separator when both languages available', () => {
    const label = createLabel([
      { text: 'Account Name', lang: 1033 },
      { text: 'Firmenname', lang: 1031 },
    ]);
    expect(formatDualLabel(label, EN_DE)).toBe('Account Name | Firmenname');
  });

  it('should return only primary when secondary not available', () => {
    const label = createLabel([{ text: 'Account Name', lang: 1033 }]);
    expect(formatDualLabel(label, EN_DE)).toBe('Account Name');
  });

  it('should return only primary when secondary matches primary', () => {
    const label = createLabel([
      { text: 'Standard', lang: 1033 },
      { text: 'Standard', lang: 1031 },
    ]);
    expect(formatDualLabel(label, EN_DE)).toBe('Standard');
  });

  it('should return only primary when no secondary configured', () => {
    const label = createLabel([
      { text: 'Account Name', lang: 1033 },
      { text: 'Firmenname', lang: 1031 },
    ]);
    expect(formatDualLabel(label, EN_ONLY)).toBe('Account Name');
  });

  it('should return empty string for empty labels', () => {
    const label: Label = { LocalizedLabels: [], UserLocalizedLabel: null };
    expect(formatDualLabel(label, EN_DE)).toBe('');
  });
});

// ─── labelToEnumMember ───────────────────────────────────────────────────────

describe('labelToEnumMember', () => {
  it('should convert simple labels to PascalCase', () => {
    expect(labelToEnumMember('Preferred Customer')).toBe('PreferredCustomer');
    expect(labelToEnumMember('Active')).toBe('Active');
    expect(labelToEnumMember('Standard')).toBe('Standard');
  });

  it('should handle labels with special characters', () => {
    expect(labelToEnumMember('Agriculture & Forestry')).toBe('AgricultureForestry');
    expect(labelToEnumMember('100% Complete')).toBe('_100Complete');
  });

  it('should handle labels starting with digits', () => {
    expect(labelToEnumMember('1st Quarter')).toBe('_1stQuarter');
  });

  it('should return empty string for empty labels', () => {
    expect(labelToEnumMember('')).toBe('');
  });

  it('should handle labels with only special characters', () => {
    expect(labelToEnumMember('---')).toBe('');
  });

  it('should handle underscores in labels (preserves casing of each word)', () => {
    // ALL-CAPS words: only first char uppercased, rest preserved
    expect(labelToEnumMember('FIELD_STATUS_ACTIVE')).toBe('FIELDSTATUSACTIVE');
    // Mixed case works naturally
    expect(labelToEnumMember('field_status_active')).toBe('FieldStatusActive');
  });

  it('should transliterate German umlauts (R6-03)', () => {
    expect(labelToEnumMember('Bevorzügter Kunde')).toBe('BevorzuegterKunde');
    expect(labelToEnumMember('Größe')).toBe('Groesse');
    expect(labelToEnumMember('Straße')).toBe('Strasse');
    expect(labelToEnumMember('Ärztlich')).toBe('Aerztlich');
    expect(labelToEnumMember('Übersicht')).toBe('Uebersicht');
  });
});

// ─── disambiguateEnumMembers ─────────────────────────────────────────────────

describe('disambiguateEnumMembers', () => {
  it('should not change unique names', () => {
    const result = disambiguateEnumMembers([
      { name: 'Active', value: 1 },
      { name: 'Inactive', value: 2 },
    ]);
    expect(result).toEqual([
      { name: 'Active', value: 1 },
      { name: 'Inactive', value: 2 },
    ]);
  });

  it('should disambiguate duplicate names with _value suffix', () => {
    const result = disambiguateEnumMembers([
      { name: 'Active', value: 1 },
      { name: 'Active', value: 2 },
      { name: 'Inactive', value: 3 },
    ]);
    expect(result).toEqual([
      { name: 'Active', value: 1 },
      { name: 'Active_2', value: 2 },
      { name: 'Inactive', value: 3 },
    ]);
  });

  it('should handle triple duplicates', () => {
    const result = disambiguateEnumMembers([
      { name: 'Active', value: 1 },
      { name: 'Active', value: 2 },
      { name: 'Active', value: 3 },
    ]);
    expect(result).toEqual([
      { name: 'Active', value: 1 },
      { name: 'Active_2', value: 2 },
      { name: 'Active_3', value: 3 },
    ]);
  });

  it('should avoid collision when suffixed name matches an existing label (H2)', () => {
    // "Active_2" exists as a real label AND "Active" is duplicated with value=2
    const result = disambiguateEnumMembers([
      { name: 'Active', value: 1 },
      { name: 'Active', value: 2 },   // Would normally become Active_2
      { name: 'Active_2', value: 3 }, // But Active_2 already exists as a label
    ]);
    expect(result[0].name).toBe('Active');
    expect(result[1].name).toBe('Active_2_v2'); // Avoids collision
    expect(result[2].name).toBe('Active_2');     // Original label preserved
  });
});
