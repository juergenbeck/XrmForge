import { describe, it, expect } from 'vitest';
import { generateOptionSetEnum, generateEntityOptionSets } from '../src/generators/optionset-generator.js';
import type { OptionSetMetadata } from '../src/metadata/types.js';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createOptionSet(overrides: Partial<OptionSetMetadata> = {}): OptionSetMetadata {
  return {
    '@odata.type': '#Microsoft.Dynamics.CRM.OptionSetMetadata',
    Name: 'accountcategorycode',
    DisplayName: { LocalizedLabels: [{ Label: 'Category', LanguageCode: 1033 }], UserLocalizedLabel: null },
    IsCustomOptionSet: false,
    IsGlobal: false,
    OptionSetType: 'Picklist',
    Options: [
      { Value: 1, Label: { LocalizedLabels: [{ Label: 'Preferred Customer', LanguageCode: 1033 }], UserLocalizedLabel: null }, Description: { LocalizedLabels: [], UserLocalizedLabel: null }, Color: null },
      { Value: 2, Label: { LocalizedLabels: [{ Label: 'Standard', LanguageCode: 1033 }], UserLocalizedLabel: null }, Description: { LocalizedLabels: [], UserLocalizedLabel: null }, Color: null },
    ],
    MetadataId: 'os-1',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('generateOptionSetEnum', () => {
  it('should generate a const enum with PascalCase members', () => {
    const result = generateOptionSetEnum(createOptionSet(), 'account', 'AccountCategoryCode');

    expect(result).toContain('export const enum AccountCategoryCode {');
    expect(result).toContain('PreferredCustomer = 1,');
    expect(result).toContain('Standard = 2,');
  });

  it('should generate JSDoc comments for each member', () => {
    const result = generateOptionSetEnum(createOptionSet(), 'account', 'AccountCategoryCode');

    expect(result).toContain('/** Preferred Customer */');
    expect(result).toContain('/** Standard */');
  });

  it('should generate dual-language JSDoc comments', () => {
    const optionSet = createOptionSet({
      Options: [
        {
          Value: 1,
          Label: {
            LocalizedLabels: [
              { Label: 'Preferred Customer', LanguageCode: 1033 },
              { Label: 'Bevorzugter Kunde', LanguageCode: 1031 },
            ],
            UserLocalizedLabel: null,
          },
          Description: { LocalizedLabels: [], UserLocalizedLabel: null },
          Color: null,
        },
      ],
    });

    const result = generateOptionSetEnum(optionSet, 'account', 'AccountCategoryCode', {
      labelConfig: { primaryLanguage: 1033, secondaryLanguage: 1031 },
    });

    expect(result).toContain('/** Preferred Customer | Bevorzugter Kunde */');
  });

  it('should disambiguate duplicate labels', () => {
    const optionSet = createOptionSet({
      Options: [
        { Value: 1, Label: { LocalizedLabels: [{ Label: 'Active', LanguageCode: 1033 }], UserLocalizedLabel: null }, Description: { LocalizedLabels: [], UserLocalizedLabel: null }, Color: null },
        { Value: 2, Label: { LocalizedLabels: [{ Label: 'Active', LanguageCode: 1033 }], UserLocalizedLabel: null }, Description: { LocalizedLabels: [], UserLocalizedLabel: null }, Color: null },
      ],
    });

    const result = generateOptionSetEnum(optionSet, 'account', 'SomeStatus');

    expect(result).toContain('Active = 1,');
    expect(result).toContain('Active_2 = 2,');
  });

  it('should use Value_ fallback for empty labels', () => {
    const optionSet = createOptionSet({
      Options: [
        { Value: 1, Label: { LocalizedLabels: [], UserLocalizedLabel: null }, Description: { LocalizedLabels: [], UserLocalizedLabel: null }, Color: null },
        { Value: 2, Label: { LocalizedLabels: [{ Label: 'Active', LanguageCode: 1033 }], UserLocalizedLabel: null }, Description: { LocalizedLabels: [], UserLocalizedLabel: null }, Color: null },
      ],
    });

    const result = generateOptionSetEnum(optionSet, 'account', 'SomeStatus');

    expect(result).toContain('Value_1 = 1,');
    expect(result).toContain('Active = 2,');
  });

  it('should use global OptionSet name for global OptionSets', () => {
    const optionSet = createOptionSet({ IsGlobal: true, Name: 'statecode' });

    const result = generateOptionSetEnum(optionSet, 'account', 'AccountCategoryCode');

    // Should use optionSet.Name (statecode -> Statecode), not attributeSchemaName
    expect(result).toContain('const enum Statecode {');
  });

  it('should generate export const enum without namespace', () => {
    const result = generateOptionSetEnum(createOptionSet(), 'account', 'AccountCategoryCode');

    expect(result).toContain('export const enum AccountCategoryCode {');
    expect(result).not.toContain('declare namespace');
  });
});

describe('generateEntityOptionSets', () => {
  it('should generate enums for all picklist attributes', () => {
    const attrs = [
      { SchemaName: 'AccountCategoryCode', OptionSet: createOptionSet(), GlobalOptionSet: null },
      { SchemaName: 'IndustryCode', OptionSet: createOptionSet({ Name: 'industrycode', Options: [{ Value: 1, Label: { LocalizedLabels: [{ Label: 'Accounting', LanguageCode: 1033 }], UserLocalizedLabel: null }, Description: { LocalizedLabels: [], UserLocalizedLabel: null }, Color: null }] }), GlobalOptionSet: null },
    ];

    const results = generateEntityOptionSets(attrs, 'account');

    expect(results).toHaveLength(2);
    expect(results[0].enumName).toBe('AccountCategoryCode');
    expect(results[1].enumName).toBe('IndustryCode');
  });

  it('should skip duplicate global OptionSets', () => {
    const globalOS = createOptionSet({ IsGlobal: true, Name: 'statecode' });
    const attrs = [
      { SchemaName: 'StateCode1', OptionSet: null, GlobalOptionSet: globalOS },
      { SchemaName: 'StateCode2', OptionSet: null, GlobalOptionSet: globalOS },
    ];

    const results = generateEntityOptionSets(attrs, 'account');

    expect(results).toHaveLength(1);
  });

  it('should skip attributes with no options', () => {
    const attrs = [
      { SchemaName: 'EmptyField', OptionSet: createOptionSet({ Options: [] }), GlobalOptionSet: null },
    ];

    const results = generateEntityOptionSets(attrs, 'account');

    expect(results).toHaveLength(0);
  });
});
