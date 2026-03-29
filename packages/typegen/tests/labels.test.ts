import { describe, it, expect } from 'vitest';
import {
  getPrimaryLabel,
  getJSDocLabel,
  labelToIdentifier,
  generateEnumMembers,
  getLabelLanguagesParam,
} from '../src/metadata/labels.js';
import type { Label, LocalizedLabel } from '../src/metadata/types.js';
import type { LabelConfig } from '../src/metadata/labels.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createLabel(en: string, de?: string): Label {
  const labels: LocalizedLabel[] = [{ Label: en, LanguageCode: 1033 }];
  if (de) labels.push({ Label: de, LanguageCode: 1031 });
  return {
    LocalizedLabels: labels,
    UserLocalizedLabel: { Label: en, LanguageCode: 1033 },
  };
}

const EN_ONLY: LabelConfig = { primaryLanguage: 1033 };
const EN_DE: LabelConfig = { primaryLanguage: 1033, secondaryLanguage: 1031 };

// ─── getPrimaryLabel ─────────────────────────────────────────────────────────

describe('getPrimaryLabel', () => {
  it('should return primary language label', () => {
    expect(getPrimaryLabel(createLabel('Account Name', 'Firmenname'), EN_ONLY)).toBe('Account Name');
  });

  it('should return empty string for null label', () => {
    expect(getPrimaryLabel(null, EN_ONLY)).toBe('');
  });

  it('should fall back to UserLocalizedLabel', () => {
    const label: Label = {
      LocalizedLabels: [], // empty
      UserLocalizedLabel: { Label: 'Fallback', LanguageCode: 1033 },
    };
    expect(getPrimaryLabel(label, EN_ONLY)).toBe('Fallback');
  });
});

// ─── getJSDocLabel ───────────────────────────────────────────────────────────

describe('getJSDocLabel', () => {
  it('should return single language when no secondary configured', () => {
    expect(getJSDocLabel(createLabel('Account Name', 'Firmenname'), EN_ONLY)).toBe('Account Name');
  });

  it('should return dual language with pipe separator', () => {
    expect(getJSDocLabel(createLabel('Account Name', 'Firmenname'), EN_DE)).toBe('Account Name | Firmenname');
  });

  it('should return primary only when secondary is missing', () => {
    expect(getJSDocLabel(createLabel('Account Name'), EN_DE)).toBe('Account Name');
  });

  it('should return primary only when both are identical', () => {
    expect(getJSDocLabel(createLabel('Standard', 'Standard'), EN_DE)).toBe('Standard');
  });

  it('should return empty string for null label', () => {
    expect(getJSDocLabel(null, EN_DE)).toBe('');
  });

  it('should return empty string for empty primary label', () => {
    const label: Label = { LocalizedLabels: [], UserLocalizedLabel: null };
    expect(getJSDocLabel(label, EN_DE)).toBe('');
  });
});

// ─── labelToIdentifier ───────────────────────────────────────────────────────

describe('labelToIdentifier', () => {
  it('should convert simple label to PascalCase', () => {
    expect(labelToIdentifier('Preferred Customer')).toBe('PreferredCustomer');
  });

  it('should handle single word', () => {
    expect(labelToIdentifier('Active')).toBe('Active');
  });

  it('should handle underscores', () => {
    expect(labelToIdentifier('in_progress')).toBe('InProgress');
  });

  it('should remove special characters', () => {
    expect(labelToIdentifier('Option (A) - First!')).toBe('OptionAFirst');
  });

  it('should transliterate German umlauts (R6-03)', () => {
    expect(labelToIdentifier('Bevorzugter Kunde')).toBe('BevorzugterKunde');
    expect(labelToIdentifier('Höchste Priorität')).toBe('HoechstePrioritaet');
    expect(labelToIdentifier('Bevorzügter Kunde')).toBe('BevorzuegterKunde');
    expect(labelToIdentifier('Straße')).toBe('Strasse');
    expect(labelToIdentifier('Größe')).toBe('Groesse');
  });

  it('should prefix with underscore if starts with digit', () => {
    expect(labelToIdentifier('1st Priority')).toBe('_1stPriority');
  });

  it('should return null for empty string', () => {
    expect(labelToIdentifier('')).toBeNull();
  });

  it('should return null for only special characters', () => {
    expect(labelToIdentifier('---')).toBeNull();
    expect(labelToIdentifier('***')).toBeNull();
  });

  it('should handle whitespace-only', () => {
    expect(labelToIdentifier('   ')).toBeNull();
  });
});

// ─── generateEnumMembers ─────────────────────────────────────────────────────

describe('generateEnumMembers', () => {
  it('should generate unique members from labels', () => {
    const options = [
      { Value: 1, Label: createLabel('Preferred Customer', 'Bevorzugter Kunde') },
      { Value: 2, Label: createLabel('Standard', 'Standard') },
    ];

    const members = generateEnumMembers(options, EN_DE);

    expect(members).toEqual([
      { name: 'PreferredCustomer', value: 1, jsDocLabel: 'Preferred Customer | Bevorzugter Kunde' },
      { name: 'Standard', value: 2, jsDocLabel: 'Standard' },
    ]);
  });

  it('should disambiguate duplicate labels with _{Value}', () => {
    const options = [
      { Value: 1, Label: createLabel('Active') },
      { Value: 2, Label: createLabel('Active') },
      { Value: 3, Label: createLabel('Inactive') },
    ];

    const members = generateEnumMembers(options, EN_ONLY);

    expect(members).toEqual([
      { name: 'Active', value: 1, jsDocLabel: 'Active' },
      { name: 'Active_2', value: 2, jsDocLabel: 'Active' },
      { name: 'Inactive', value: 3, jsDocLabel: 'Inactive' },
    ]);
  });

  it('should handle three-way duplicates', () => {
    const options = [
      { Value: 10, Label: createLabel('New') },
      { Value: 20, Label: createLabel('New') },
      { Value: 30, Label: createLabel('New') },
    ];

    const members = generateEnumMembers(options, EN_ONLY);

    expect(members[0]!.name).toBe('New');
    expect(members[1]!.name).toBe('New_20');
    expect(members[2]!.name).toBe('New_30');
  });

  it('should fall back to Value_{n} for unconvertible labels', () => {
    const options = [
      { Value: 1, Label: createLabel('---') },
      { Value: 2, Label: createLabel('') },
      { Value: 3, Label: createLabel('Good') },
    ];

    const members = generateEnumMembers(options, EN_ONLY);

    expect(members[0]!.name).toBe('Value_1');
    expect(members[1]!.name).toBe('Value_2');
    expect(members[2]!.name).toBe('Good');
  });

  it('should preserve JSDoc even when name is disambiguated', () => {
    const options = [
      { Value: 1, Label: createLabel('Active', 'Aktiv') },
      { Value: 2, Label: createLabel('Active', 'Aktiv') },
    ];

    const members = generateEnumMembers(options, EN_DE);

    expect(members[0]!.jsDocLabel).toBe('Active | Aktiv');
    expect(members[1]!.jsDocLabel).toBe('Active | Aktiv');
    expect(members[0]!.name).toBe('Active');
    expect(members[1]!.name).toBe('Active_2');
  });

  it('should handle empty options array', () => {
    const members = generateEnumMembers([], EN_ONLY);
    expect(members).toEqual([]);
  });
});

// ─── getLabelLanguagesParam ──────────────────────────────────────────────────

describe('getLabelLanguagesParam', () => {
  it('should return single language', () => {
    expect(getLabelLanguagesParam(EN_ONLY)).toBe('&LabelLanguages=1033');
  });

  it('should return both languages', () => {
    expect(getLabelLanguagesParam(EN_DE)).toBe('&LabelLanguages=1033,1031');
  });

  it('should not duplicate when primary equals secondary', () => {
    expect(getLabelLanguagesParam({ primaryLanguage: 1033, secondaryLanguage: 1033 }))
      .toBe('&LabelLanguages=1033');
  });
});
