import { describe, it, expect } from 'vitest';
import { generateEntityInterface } from '../src/generators/entity-generator.js';
import type { EntityTypeInfo, AttributeMetadata, LookupAttributeMetadata } from '../src/metadata/types.js';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createAttr(overrides: Partial<AttributeMetadata>): AttributeMetadata {
  return {
    LogicalName: 'testfield',
    SchemaName: 'TestField',
    AttributeType: 'String',
    DisplayName: { LocalizedLabels: [{ Label: 'Test Field', LanguageCode: 1033 }], UserLocalizedLabel: { Label: 'Test Field', LanguageCode: 1033 } },
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

function createEntityInfo(attributes: AttributeMetadata[], lookupAttributes: LookupAttributeMetadata[] = []): EntityTypeInfo {
  return {
    entity: {
      LogicalName: 'account',
      SchemaName: 'Account',
      EntitySetName: 'accounts',
      DisplayName: { LocalizedLabels: [{ Label: 'Account', LanguageCode: 1033 }], UserLocalizedLabel: { Label: 'Account', LanguageCode: 1033 } },
      PrimaryIdAttribute: 'accountid',
      PrimaryNameAttribute: 'name',
      OwnershipType: 'UserOwned',
      IsCustomEntity: false,
      LogicalCollectionName: 'accounts',
      MetadataId: 'entity-1',
    },
    attributes,
    picklistAttributes: [],
    multiSelectPicklistAttributes: [],
    lookupAttributes,
    statusAttributes: [],
    stateAttributes: [],
    forms: [],
    oneToManyRelationships: [],
    manyToOneRelationships: [],
    manyToManyRelationships: [],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('generateEntityInterface', () => {
  it('should generate a basic entity interface with namespace', () => {
    const info = createEntityInfo([
      createAttr({ LogicalName: 'accountid', AttributeType: 'Uniqueidentifier', IsPrimaryId: true }),
      createAttr({ LogicalName: 'name', AttributeType: 'String', DisplayName: { LocalizedLabels: [{ Label: 'Account Name', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityInterface(info);

    expect(result).toContain('export interface Account {');
    expect(result).toContain('accountid: string;'); // Primary ID is never null in a WebApi response
    expect(result).toContain('name: string | null;');
  });

  it('should generate JSDoc comments from labels', () => {
    const info = createEntityInfo([
      createAttr({ LogicalName: 'name', AttributeType: 'String', DisplayName: { LocalizedLabels: [{ Label: 'Account Name', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityInterface(info);

    expect(result).toContain('/** Account Name */');
  });

  it('should generate dual-language JSDoc when configured', () => {
    const info = createEntityInfo([
      createAttr({
        LogicalName: 'name',
        AttributeType: 'String',
        DisplayName: {
          LocalizedLabels: [
            { Label: 'Account Name', LanguageCode: 1033 },
            { Label: 'Firmenname', LanguageCode: 1031 },
          ],
          UserLocalizedLabel: null,
        },
      }),
    ]);

    const result = generateEntityInterface(info, {
      labelConfig: { primaryLanguage: 1033, secondaryLanguage: 1031 },
    });

    expect(result).toContain('/** Account Name | Firmenname */');
  });

  it('should map lookup fields to _fieldname_value pattern', () => {
    const lookupAttr = createAttr({ LogicalName: 'primarycontactid', AttributeType: 'Lookup' });
    const lookupMeta: LookupAttributeMetadata = { ...lookupAttr, Targets: ['contact'] };

    const info = createEntityInfo([lookupAttr], [lookupMeta]);

    const result = generateEntityInterface(info);

    expect(result).toContain('_primarycontactid_value: string | null;');
    expect(result).not.toContain('primarycontactid: string | null;');
  });

  it('should add lookup target info in JSDoc', () => {
    const lookupAttr = createAttr({
      LogicalName: 'ownerid',
      AttributeType: 'Owner',
      DisplayName: { LocalizedLabels: [{ Label: 'Owner', LanguageCode: 1033 }], UserLocalizedLabel: null },
    });
    const lookupMeta: LookupAttributeMetadata = { ...lookupAttr, Targets: ['systemuser', 'team'] };

    const info = createEntityInfo([lookupAttr], [lookupMeta]);

    const result = generateEntityInterface(info);

    expect(result).toContain('/** Owner - Lookup (systemuser | team) */');
  });

  it('should map different attribute types correctly', () => {
    const info = createEntityInfo([
      createAttr({ LogicalName: 'name', AttributeType: 'String' }),
      createAttr({ LogicalName: 'revenue', AttributeType: 'Money' }),
      createAttr({ LogicalName: 'donotemail', AttributeType: 'Boolean' }),
      createAttr({ LogicalName: 'createdon', AttributeType: 'DateTime' }),
      createAttr({ LogicalName: 'employees', AttributeType: 'Integer' }),
      createAttr({ LogicalName: 'statuscode', AttributeType: 'Status' }),
    ]);

    const result = generateEntityInterface(info);

    expect(result).toContain('name: string | null;');
    expect(result).toContain('revenue: number | null;');
    expect(result).toContain('donotemail: boolean | null;');
    expect(result).toContain('createdon: string | null;');
    expect(result).toContain('employees: number | null;');
    expect(result).toContain('statuscode: number | null;');
  });

  it('should exclude Virtual, ManagedProperty and EntityName lookup companions, but keep standalone EntityName fields', () => {
    const info = createEntityInfo([
      createAttr({ LogicalName: 'name', AttributeType: 'String' }),
      createAttr({ LogicalName: 'entityimage', AttributeType: 'Virtual' }),
      // EntityName lookup companion: AttributeOf points at its lookup -> excluded
      createAttr({ LogicalName: 'owneridtype', AttributeType: 'EntityName', AttributeOf: 'ownerid' }),
      // Standalone EntityName field (no AttributeOf) -> kept (F-LMA11-04)
      createAttr({ LogicalName: 'activitytypecode', AttributeType: 'EntityName' }),
      createAttr({ LogicalName: 'iscustomizable', AttributeType: 'ManagedProperty' }),
    ]);

    const result = generateEntityInterface(info);

    expect(result).toContain('name: string | null;');
    expect(result).toContain('activitytypecode: string | null;');
    expect(result).not.toContain('entityimage');
    expect(result).not.toContain('owneridtype');
    expect(result).not.toContain('iscustomizable');
  });

  it('should mark read-only fields in JSDoc', () => {
    const info = createEntityInfo([
      createAttr({
        LogicalName: 'revenue_base',
        AttributeType: 'Money',
        IsValidForCreate: false,
        IsValidForUpdate: false,
        DisplayName: { LocalizedLabels: [{ Label: 'Revenue (Base)', LanguageCode: 1033 }], UserLocalizedLabel: null },
      }),
    ]);

    const result = generateEntityInterface(info);

    expect(result).toContain('read-only');
  });

  it('should sort attributes alphabetically', () => {
    const info = createEntityInfo([
      createAttr({ LogicalName: 'zzz_field', AttributeType: 'String' }),
      createAttr({ LogicalName: 'aaa_field', AttributeType: 'String' }),
      createAttr({ LogicalName: 'mmm_field', AttributeType: 'String' }),
    ]);

    const result = generateEntityInterface(info);
    const lines = result.split('\n');
    const fieldLines = lines.filter((l) => l.includes('| null;'));

    expect(fieldLines[0]).toContain('aaa_field');
    expect(fieldLines[1]).toContain('mmm_field');
    expect(fieldLines[2]).toContain('zzz_field');
  });

  it('should generate export interface without namespace', () => {
    const info = createEntityInfo([]);

    const result = generateEntityInterface(info);

    expect(result).toContain('export interface Account {');
    expect(result).not.toContain('declare namespace');
  });

  it('should generate an empty interface for entity with no attributes', () => {
    const info = createEntityInfo([]);

    const result = generateEntityInterface(info);

    expect(result).toContain('export interface Account {');
    expect(result).toContain('}');
    // The interface should have no field declarations (no "| null;" lines)
    const fieldLines = result.split('\n').filter((l) => l.includes('| null;'));
    expect(fieldLines).toHaveLength(0);
  });
});
