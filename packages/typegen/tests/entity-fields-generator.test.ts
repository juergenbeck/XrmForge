import { describe, it, expect } from 'vitest';
import { generateEntityFieldsEnum, generateEntityNavigationProperties, generateEntityExpands } from '../src/generators/entity-fields-generator.js';
import type { EntityTypeInfo, AttributeMetadata, LookupAttributeMetadata, OneToManyRelationshipMetadata } from '../src/metadata/types.js';

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

function createEntityInfo(
  attributes: AttributeMetadata[],
  lookupAttributes: LookupAttributeMetadata[] = [],
  manyToOneRelationships: OneToManyRelationshipMetadata[] = [],
): EntityTypeInfo {
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
    lookupAttributes,
    statusAttributes: [],
    stateAttributes: [],
    forms: [],
    oneToManyRelationships: [],
    manyToOneRelationships,
    manyToManyRelationships: [],
  };
}

/** Build a lookup attribute (carries Targets) from a base attribute. */
function createLookupAttr(logicalName: string, schemaName: string, attributeType: string, targets: string[]): LookupAttributeMetadata {
  return { ...createAttr({ LogicalName: logicalName, SchemaName: schemaName, AttributeType: attributeType }), Targets: targets };
}

/** Build an N:1 relationship carrying the authoritative navigation property name. */
function createN1(referencingAttribute: string, referencedEntity: string, navName: string): OneToManyRelationshipMetadata {
  return {
    SchemaName: `rel_${referencingAttribute}_${referencedEntity}`,
    ReferencingEntity: 'account',
    ReferencingAttribute: referencingAttribute,
    ReferencedEntity: referencedEntity,
    ReferencedAttribute: `${referencedEntity}id`,
    ReferencingEntityNavigationPropertyName: navName,
    MetadataId: `rel-${referencingAttribute}-${referencedEntity}`,
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

// ─── generateEntityExpands ──────────────────────────────────────────────────

describe('generateEntityExpands', () => {
  it('generates target-qualified members for a polymorphic Customer lookup', () => {
    const info = createEntityInfo(
      [createAttr({ LogicalName: 'customerid', SchemaName: 'CustomerId', AttributeType: 'Customer', DisplayName: { LocalizedLabels: [{ Label: 'Customer', LanguageCode: 1033 }], UserLocalizedLabel: null } })],
      [createLookupAttr('customerid', 'CustomerId', 'Customer', ['account', 'contact'])],
      [createN1('customerid', 'account', 'customerid_account'), createN1('customerid', 'contact', 'customerid_contact')],
    );

    const result = generateEntityExpands(info);

    expect(result).toContain('export const enum AccountExpands {');
    expect(result).toContain("CustomerId_Account = 'customerid_account',");
    expect(result).toContain("CustomerId_Contact = 'customerid_contact',");
  });

  it('excludes Owner-type lookups (ownerid expands via the separate owninguser/owningteam lookups)', () => {
    // Verified live on markant-dev: ownerid has Targets [systemuser, team] but NO
    // ownerid_<target> navigation properties - its only N:1 relationship points to the
    // `owner` abstraction (nav name `ownerid`). The real expand paths owninguser/owningteam/
    // owningbusinessunit are SEPARATE single-target lookup fields (own ReferencingAttribute),
    // already covered by XxxNavigationProperties. So Owner yields no XxxExpands members.
    const info = createEntityInfo(
      [createAttr({ LogicalName: 'ownerid', SchemaName: 'OwnerId', AttributeType: 'Owner', DisplayName: { LocalizedLabels: [{ Label: 'Owner', LanguageCode: 1033 }], UserLocalizedLabel: null } })],
      [createLookupAttr('ownerid', 'OwnerId', 'Owner', ['systemuser', 'team'])],
      [createN1('ownerid', 'owner', 'ownerid')], // the real shape: one relationship to the owner abstraction
    );

    expect(generateEntityExpands(info)).toBe('');
  });

  it('preserves SchemaName casing of a custom polymorphic lookup (value is read, not constructed)', () => {
    const info = createEntityInfo(
      [createAttr({ LogicalName: 'sample_mediapolymorphiclookup', SchemaName: 'sample_MediaPolymorphicLookup', AttributeType: 'Lookup', DisplayName: { LocalizedLabels: [{ Label: 'Media', LanguageCode: 1033 }], UserLocalizedLabel: null } })],
      [createLookupAttr('sample_mediapolymorphiclookup', 'sample_MediaPolymorphicLookup', 'Lookup', ['sample_book', 'sample_audio'])],
      [
        createN1('sample_mediapolymorphiclookup', 'sample_book', 'sample_MediaPolymorphicLookup_sample_book'),
        createN1('sample_mediapolymorphiclookup', 'sample_audio', 'sample_MediaPolymorphicLookup_sample_audio'),
      ],
    );

    const result = generateEntityExpands(info);

    expect(result).toContain("= 'sample_MediaPolymorphicLookup_sample_book',");
    expect(result).toContain("= 'sample_MediaPolymorphicLookup_sample_audio',");
    // lowercase logical-name construction must NOT leak in
    expect(result).not.toContain("'sample_mediapolymorphiclookup_sample_book'");
  });

  it('emits nothing for a single-target lookup (those use NavigationProperties)', () => {
    const info = createEntityInfo(
      [createAttr({ LogicalName: 'primarycontactid', SchemaName: 'PrimaryContactId', AttributeType: 'Lookup', DisplayName: { LocalizedLabels: [{ Label: 'Primary Contact', LanguageCode: 1033 }], UserLocalizedLabel: null } })],
      [createLookupAttr('primarycontactid', 'PrimaryContactId', 'Lookup', ['contact'])],
      [createN1('primarycontactid', 'contact', 'primarycontactid')],
    );

    expect(generateEntityExpands(info)).toBe('');
  });

  it('skips a target whose navigation property name is missing (never constructs it)', () => {
    const info = createEntityInfo(
      [createAttr({ LogicalName: 'customerid', SchemaName: 'CustomerId', AttributeType: 'Customer', DisplayName: { LocalizedLabels: [{ Label: 'Customer', LanguageCode: 1033 }], UserLocalizedLabel: null } })],
      [createLookupAttr('customerid', 'CustomerId', 'Customer', ['account', 'contact'])],
      [createN1('customerid', 'account', 'customerid_account')], // contact relationship missing
    );

    const result = generateEntityExpands(info);

    expect(result).toContain("CustomerId_Account = 'customerid_account',");
    expect(result).not.toContain('CustomerId_Contact');
    expect(result).not.toContain('customerid_contact');
  });

  it('returns empty string when no polymorphic lookup target can be resolved', () => {
    const info = createEntityInfo(
      [createAttr({ LogicalName: 'customerid', SchemaName: 'CustomerId', AttributeType: 'Customer', DisplayName: { LocalizedLabels: [{ Label: 'Customer', LanguageCode: 1033 }], UserLocalizedLabel: null } })],
      [createLookupAttr('customerid', 'CustomerId', 'Customer', ['account', 'contact'])],
      [], // no relationship metadata at all
    );

    expect(generateEntityExpands(info)).toBe('');
  });

  it('emits the dual-language label plus target in the JSDoc', () => {
    const info = createEntityInfo(
      [createAttr({ LogicalName: 'customerid', SchemaName: 'CustomerId', AttributeType: 'Customer', DisplayName: { LocalizedLabels: [{ Label: 'Customer', LanguageCode: 1033 }, { Label: 'Kunde', LanguageCode: 1031 }], UserLocalizedLabel: null } })],
      [createLookupAttr('customerid', 'CustomerId', 'Customer', ['account', 'contact'])],
      [createN1('customerid', 'account', 'customerid_account'), createN1('customerid', 'contact', 'customerid_contact')],
    );

    const result = generateEntityExpands(info, { labelConfig: { primaryLanguage: 1033, secondaryLanguage: 1031 } });

    expect(result).toContain('/** Customer | Kunde -> account */');
    expect(result).toContain('/** Customer | Kunde -> contact */');
  });

  it('is deterministic across renders (lookups and targets sorted regardless of input order)', () => {
    const build = () => createEntityInfo(
      [
        createAttr({ LogicalName: 'customerid', SchemaName: 'CustomerId', AttributeType: 'Customer', DisplayName: { LocalizedLabels: [{ Label: 'Customer', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
        createAttr({ LogicalName: 'markant_relatedpartyid', SchemaName: 'markant_RelatedPartyId', AttributeType: 'Lookup', DisplayName: { LocalizedLabels: [{ Label: 'Related Party', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
      ],
      [createLookupAttr('customerid', 'CustomerId', 'Customer', ['contact', 'account']), createLookupAttr('markant_relatedpartyid', 'markant_RelatedPartyId', 'Lookup', ['contact', 'account'])],
      [
        createN1('customerid', 'account', 'customerid_account'),
        createN1('customerid', 'contact', 'customerid_contact'),
        createN1('markant_relatedpartyid', 'account', 'markant_RelatedPartyId_account'),
        createN1('markant_relatedpartyid', 'contact', 'markant_RelatedPartyId_contact'),
      ],
    );
    expect(generateEntityExpands(build())).toBe(generateEntityExpands(build()));
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

  it('SchemaName fallback: empty SchemaName falls back to the PascalCased LogicalName', () => {
    // Real Dataverse always provides SchemaName (typed required). This guards an
    // incomplete API response so the member stays a valid, guessable identifier.
    const info = createEntityInfo([
      createAttr({ LogicalName: 'markant_foo', SchemaName: '', AttributeType: 'String', DisplayName: { LocalizedLabels: [{ Label: 'Foo', LanguageCode: 1033 }], UserLocalizedLabel: null } }),
    ]);

    const result = generateEntityFieldsEnum(info);

    expect(result).toContain("MarkantFoo = 'markant_foo',");
  });
});
