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
    multiSelectPicklistAttributes: [],
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
  it('should generate navigation properties for lookup fields (SchemaName members)', () => {
    const info = createEntityInfo([
      createAttr({ LogicalName: 'name', SchemaName: 'Name', AttributeType: 'String', DisplayName: { LocalizedLabels: [{ Label: 'Name', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
      createAttr({ LogicalName: 'primarycontactid', SchemaName: 'PrimaryContactId', AttributeType: 'Lookup', DisplayName: { LocalizedLabels: [{ Label: 'Primary Contact', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
      createAttr({ LogicalName: 'ownerid', SchemaName: 'OwnerId', AttributeType: 'Owner', DisplayName: { LocalizedLabels: [{ Label: 'Owner', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityNavigationProperties(info);

    expect(result).toContain('const enum AccountNavigationProperties {');
    expect(result).toContain("PrimaryContactId = 'primarycontactid',");
    expect(result).toContain("OwnerId = 'ownerid',");
  });

  it('should use LogicalName as value (NOT _value format)', () => {
    const info = createEntityInfo([
      createAttr({ LogicalName: 'parentaccountid', SchemaName: 'ParentAccountId', AttributeType: 'Lookup', DisplayName: { LocalizedLabels: [{ Label: 'Parent Account', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityNavigationProperties(info);

    // LogicalName direkt, NICHT _parentaccountid_value
    expect(result).toContain("ParentAccountId = 'parentaccountid',");
    expect(result).not.toContain('_parentaccountid_value');
  });

  it('should exclude non-lookup fields', () => {
    const info = createEntityInfo([
      createAttr({ LogicalName: 'name', SchemaName: 'Name', AttributeType: 'String', DisplayName: { LocalizedLabels: [{ Label: 'Name', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
      createAttr({ LogicalName: 'revenue', SchemaName: 'Revenue', AttributeType: 'Money', DisplayName: { LocalizedLabels: [{ Label: 'Revenue', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
      createAttr({ LogicalName: 'statecode', SchemaName: 'StateCode', AttributeType: 'State', DisplayName: { LocalizedLabels: [{ Label: 'Status', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityNavigationProperties(info);

    // Keine Lookup-Felder -> leerer String
    expect(result).toBe('');
  });

  it('should include Customer type lookups', () => {
    const info = createEntityInfo([
      createAttr({ LogicalName: 'customerid', SchemaName: 'CustomerId', AttributeType: 'Customer', DisplayName: { LocalizedLabels: [{ Label: 'Customer', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityNavigationProperties(info);

    expect(result).toContain("CustomerId = 'customerid',");
  });

  it('should generate dual-language labels in JSDoc (member stays SchemaName)', () => {
    const info = createEntityInfo([
      createAttr({
        LogicalName: 'markant_countryid',
        SchemaName: 'markant_CountryId',
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
    expect(result).toContain("markant_CountryId = 'markant_countryid',");
  });

  it('should give distinct SchemaName members for lookups with the same label (no ordinal)', () => {
    // createdby and modifiedby both carry the label "Created By" in this fixture.
    // Label-based naming would have produced CreatedBy / CreatedBy2 (order-fragile).
    // SchemaName-based naming keeps them distinct and guessable.
    const info = createEntityInfo([
      createAttr({ LogicalName: 'createdby', SchemaName: 'CreatedBy', AttributeType: 'Lookup', DisplayName: { LocalizedLabels: [{ Label: 'Created By', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
      createAttr({ LogicalName: 'modifiedby', SchemaName: 'ModifiedBy', AttributeType: 'Lookup', DisplayName: { LocalizedLabels: [{ Label: 'Created By', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityNavigationProperties(info);

    expect(result).toContain("CreatedBy = 'createdby',");
    expect(result).toContain("ModifiedBy = 'modifiedby',");
    expect(result).not.toContain('CreatedBy2');
  });
});

// ─── generateEntityFieldsEnum ───────────────────────────────────────────────

describe('generateEntityFieldsEnum', () => {
  it('should generate export const enum syntax (not declare namespace)', () => {
    const info = createEntityInfo([
      createAttr({ LogicalName: 'name', SchemaName: 'Name', AttributeType: 'String', DisplayName: { LocalizedLabels: [{ Label: 'Name', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityFieldsEnum(info);

    expect(result).toContain('export const enum AccountFields {');
    expect(result).not.toContain('declare namespace');
  });

  it('should generate fields enum with _value format for lookups (SchemaName member)', () => {
    const info = createEntityInfo([
      createAttr({ LogicalName: 'name', SchemaName: 'Name', AttributeType: 'String', DisplayName: { LocalizedLabels: [{ Label: 'Name', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
      createAttr({ LogicalName: 'primarycontactid', SchemaName: 'PrimaryContactId', AttributeType: 'Lookup', DisplayName: { LocalizedLabels: [{ Label: 'Primary Contact', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityFieldsEnum(info);

    expect(result).toContain("Name = 'name',");
    expect(result).toContain("PrimaryContactId = '_primarycontactid_value',");
  });

  it('F-MK9-07: member is the SchemaName, not the display label', () => {
    // statecode has label "Status"; label-based naming produced AccountFields.Status
    // (unguessable). SchemaName-based naming produces StateCode (guessable from the
    // logical name).
    const info = createEntityInfo([
      createAttr({ LogicalName: 'statecode', SchemaName: 'StateCode', AttributeType: 'State', DisplayName: { LocalizedLabels: [{ Label: 'Status', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityFieldsEnum(info);

    expect(result).toContain("StateCode = 'statecode',");
    expect(result).toContain('/** Status */'); // label preserved in JSDoc
    expect(result).not.toContain('Status =');
  });

  it('F-MK9-05: identical labels on distinct fields stay distinct and ordinal-free', () => {
    // Ten *_israted fields share the label "Take into account in overall rating".
    // Label-based naming produced TakeIntoAccountInOverallRating / ...2 / ...3
    // (order-fragile). SchemaName-based naming keeps each field's stable identifier.
    const label = { LocalizedLabels: [{ Label: 'Take into account in overall rating', LanguageCode: 1033 }], UserLocalizedLabel: null };
    const info = createEntityInfo([
      createAttr({ LogicalName: 'markant_afeedback_israted', SchemaName: 'markant_AFeedback_IsRated', AttributeType: 'Boolean', DisplayName: label }),
      createAttr({ LogicalName: 'markant_bfeedback_israted', SchemaName: 'markant_BFeedback_IsRated', AttributeType: 'Boolean', DisplayName: label }),
    ]);

    const result = generateEntityFieldsEnum(info);

    expect(result).toContain("markant_AFeedback_IsRated = 'markant_afeedback_israted',");
    expect(result).toContain("markant_BFeedback_IsRated = 'markant_bfeedback_israted',");
    // No order-dependent ordinal suffix anywhere
    expect(result).not.toMatch(/IsRated2\b/);
  });

  it('defensive guard: pathological identical SchemaNames are disambiguated deterministically via LogicalName', () => {
    // Cannot happen with real Dataverse metadata (SchemaNames are unique), but the
    // guard must be deterministic if it ever does.
    const info = createEntityInfo([
      createAttr({ LogicalName: 'foo_a', SchemaName: 'Dup', AttributeType: 'String', DisplayName: { LocalizedLabels: [{ Label: 'A', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
      createAttr({ LogicalName: 'foo_b', SchemaName: 'Dup', AttributeType: 'String', DisplayName: { LocalizedLabels: [{ Label: 'B', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityFieldsEnum(info);

    // foo_a sorts before foo_b, so 'Dup' goes to foo_a, the suffix to foo_b
    expect(result).toContain("Dup = 'foo_a',");
    expect(result).toContain("Dup_foo_b = 'foo_b',");
  });
});
