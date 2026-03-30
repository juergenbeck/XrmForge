import { describe, it, expect } from 'vitest';
import { generateEntityFieldsEnum, generateEntityNavigationProperties } from '../src/generators/entity-fields-generator.js';
import type { EntityTypeInfo, AttributeMetadata } from '../src/metadata/types.js';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createAttr(overrides: Partial<AttributeMetadata>): AttributeMetadata {
  return {
    LogicalName: 'testfield',
    SchemaName: 'TestField',
    AttributeType: 'String',
    DisplayName: { LocalizedLabels: [{ Label: 'Test Field', LanguageCode: 1033 }], UserLocalizedLabel: null },
    IsPrimaryId: false,
    IsPrimaryName: false,
    RequiredLevel: { Value: 'None' },
    IsValidForRead: true,
    IsValidForCreate: true,
    IsValidForUpdate: true,
    MetadataId: 'test-1',
    ...overrides,
  };
}

function createEntityInfo(attributes: AttributeMetadata[]): EntityTypeInfo {
  return {
    entity: {
      LogicalName: 'account',
      SchemaName: 'Account',
      EntitySetName: 'accounts',
      DisplayName: { LocalizedLabels: [{ Label: 'Account', LanguageCode: 1033 }], UserLocalizedLabel: null },
      PrimaryIdAttribute: 'accountid',
      PrimaryNameAttribute: 'name',
      OwnershipType: 'UserOwned',
      IsCustomEntity: false,
      LogicalCollectionName: 'accounts',
      MetadataId: 'entity-1',
    },
    attributes,
    picklistAttributes: [],
    lookupAttributes: [],
    statusAttributes: [],
    stateAttributes: [],
    forms: [],
    oneToManyRelationships: [],
    manyToManyRelationships: [],
  };
}

// ─── generateEntityNavigationProperties ─────────────────────────────────────

describe('generateEntityNavigationProperties', () => {
  it('should generate navigation properties for lookup fields', () => {
    const info = createEntityInfo([
      createAttr({ LogicalName: 'name', AttributeType: 'String', DisplayName: { LocalizedLabels: [{ Label: 'Name', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
      createAttr({ LogicalName: 'primarycontactid', AttributeType: 'Lookup', DisplayName: { LocalizedLabels: [{ Label: 'Primary Contact', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
      createAttr({ LogicalName: 'ownerid', AttributeType: 'Owner', DisplayName: { LocalizedLabels: [{ Label: 'Owner', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityNavigationProperties(info);

    expect(result).toContain('const enum AccountNavigationProperties {');
    expect(result).toContain("PrimaryContact = 'primarycontactid',");
    expect(result).toContain("Owner = 'ownerid',");
  });

  it('should use LogicalName as value (NOT _value format)', () => {
    const info = createEntityInfo([
      createAttr({ LogicalName: 'parentaccountid', AttributeType: 'Lookup', DisplayName: { LocalizedLabels: [{ Label: 'Parent Account', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityNavigationProperties(info);

    // LogicalName direkt, NICHT _parentaccountid_value
    expect(result).toContain("ParentAccount = 'parentaccountid',");
    expect(result).not.toContain('_parentaccountid_value');
  });

  it('should exclude non-lookup fields', () => {
    const info = createEntityInfo([
      createAttr({ LogicalName: 'name', AttributeType: 'String', DisplayName: { LocalizedLabels: [{ Label: 'Name', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
      createAttr({ LogicalName: 'revenue', AttributeType: 'Money', DisplayName: { LocalizedLabels: [{ Label: 'Revenue', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
      createAttr({ LogicalName: 'statecode', AttributeType: 'State', DisplayName: { LocalizedLabels: [{ Label: 'Status', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityNavigationProperties(info);

    // Keine Lookup-Felder -> leerer String
    expect(result).toBe('');
  });

  it('should include Customer type lookups', () => {
    const info = createEntityInfo([
      createAttr({ LogicalName: 'customerid', AttributeType: 'Customer', DisplayName: { LocalizedLabels: [{ Label: 'Customer', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityNavigationProperties(info);

    expect(result).toContain("Customer = 'customerid',");
  });

  it('should generate dual-language labels', () => {
    const info = createEntityInfo([
      createAttr({
        LogicalName: 'markant_countryid',
        AttributeType: 'Lookup',
        DisplayName: {
          LocalizedLabels: [
            { Label: 'Country', LanguageCode: 1033 },
            { Label: 'Land', LanguageCode: 1031 },
          ],
          UserLocalizedLabel: null,
        },
      }),
    ]);

    const result = generateEntityNavigationProperties(info, {
      labelConfig: { primaryLanguage: 1033, secondaryLanguage: 1031 },
    });

    expect(result).toContain('/** Country | Land */');
    expect(result).toContain("Country = 'markant_countryid',");
  });

  it('should disambiguate duplicate member names', () => {
    const info = createEntityInfo([
      createAttr({ LogicalName: 'createdby', AttributeType: 'Lookup', DisplayName: { LocalizedLabels: [{ Label: 'Created By', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
      createAttr({ LogicalName: 'modifiedby', AttributeType: 'Lookup', DisplayName: { LocalizedLabels: [{ Label: 'Created By', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityNavigationProperties(info);

    expect(result).toContain("CreatedBy = 'createdby',");
    expect(result).toContain("CreatedBy2 = 'modifiedby',");
  });
});

// ─── generateEntityFieldsEnum (bestehende Funktionalität) ───────────────────

describe('generateEntityFieldsEnum', () => {
  it('should generate fields enum with _value format for lookups', () => {
    const info = createEntityInfo([
      createAttr({ LogicalName: 'name', AttributeType: 'String', DisplayName: { LocalizedLabels: [{ Label: 'Name', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
      createAttr({ LogicalName: 'primarycontactid', AttributeType: 'Lookup', DisplayName: { LocalizedLabels: [{ Label: 'Primary Contact', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityFieldsEnum(info);

    expect(result).toContain("Name = 'name',");
    expect(result).toContain("PrimaryContact = '_primarycontactid_value',");
  });
});
