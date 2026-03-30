import { describe, it, expect } from 'vitest';
import {
  getEntityPropertyType,
  getFormAttributeType,
  getFormControlType,
  toSafeIdentifier,
  toPascalCase,
  toLookupValueProperty,
  isLookupType,
  shouldIncludeInEntityInterface,
} from '../src/generators/type-mapping.js';
import type { AttributeMetadata } from '../src/metadata/types.js';

// ─── Entity Property Types ───────────────────────────────────────────────────

describe('getEntityPropertyType', () => {
  it('should map String to string', () => {
    expect(getEntityPropertyType('String')).toBe('string');
  });

  it('should map Memo to string', () => {
    expect(getEntityPropertyType('Memo')).toBe('string');
  });

  it('should map Integer to number', () => {
    expect(getEntityPropertyType('Integer')).toBe('number');
  });

  it('should map Money to number', () => {
    expect(getEntityPropertyType('Money')).toBe('number');
  });

  it('should map Decimal to number', () => {
    expect(getEntityPropertyType('Decimal')).toBe('number');
  });

  it('should map Boolean to boolean', () => {
    expect(getEntityPropertyType('Boolean')).toBe('boolean');
  });

  it('should map Picklist to number', () => {
    expect(getEntityPropertyType('Picklist')).toBe('number');
  });

  it('should map State/Status to number', () => {
    expect(getEntityPropertyType('State')).toBe('number');
    expect(getEntityPropertyType('Status')).toBe('number');
  });

  it('should map MultiSelectPicklist to string (Web API returns comma-separated values)', () => {
    // Verified live: Xrm.WebApi returns "595300001" or "595300000,595300001" as string
    expect(getEntityPropertyType('MultiSelectPicklist')).toBe('string');
  });

  it('should map DateTime to string (ISO 8601)', () => {
    expect(getEntityPropertyType('DateTime')).toBe('string');
  });

  it('should map Uniqueidentifier to string', () => {
    expect(getEntityPropertyType('Uniqueidentifier')).toBe('string');
  });

  it('should map Double and BigInt to number', () => {
    expect(getEntityPropertyType('Double')).toBe('number');
    expect(getEntityPropertyType('BigInt')).toBe('number');
  });

  it('should map EntityName to string', () => {
    expect(getEntityPropertyType('EntityName')).toBe('string');
  });

  it('should return string for lookups regardless of attributeType', () => {
    expect(getEntityPropertyType('Lookup', true)).toBe('string');
    expect(getEntityPropertyType('Customer', true)).toBe('string');
    expect(getEntityPropertyType('Owner', true)).toBe('string');
  });

  it('should return unknown for unmapped types', () => {
    expect(getEntityPropertyType('SomeFutureType')).toBe('unknown');
    expect(getEntityPropertyType('Virtual')).toBe('unknown');
    expect(getEntityPropertyType('ManagedProperty')).toBe('unknown'); // filtered by shouldIncludeInEntityInterface
  });
});

// ─── Form Attribute Types ────────────────────────────────────────────────────

describe('getFormAttributeType', () => {
  it('should map String to Xrm.Attributes.StringAttribute', () => {
    expect(getFormAttributeType('String')).toBe('Xrm.Attributes.StringAttribute');
  });

  it('should map Integer to Xrm.Attributes.NumberAttribute', () => {
    expect(getFormAttributeType('Integer')).toBe('Xrm.Attributes.NumberAttribute');
  });

  it('should map Money to Xrm.Attributes.NumberAttribute', () => {
    expect(getFormAttributeType('Money')).toBe('Xrm.Attributes.NumberAttribute');
  });

  it('should map Boolean to Xrm.Attributes.BooleanAttribute', () => {
    expect(getFormAttributeType('Boolean')).toBe('Xrm.Attributes.BooleanAttribute');
  });

  it('should map Memo to Xrm.Attributes.StringAttribute', () => {
    expect(getFormAttributeType('Memo')).toBe('Xrm.Attributes.StringAttribute');
  });

  it('should map Decimal/Double/BigInt to Xrm.Attributes.NumberAttribute', () => {
    expect(getFormAttributeType('Decimal')).toBe('Xrm.Attributes.NumberAttribute');
    expect(getFormAttributeType('Double')).toBe('Xrm.Attributes.NumberAttribute');
    expect(getFormAttributeType('BigInt')).toBe('Xrm.Attributes.NumberAttribute');
  });

  it('should map Picklist to Xrm.Attributes.OptionSetAttribute', () => {
    expect(getFormAttributeType('Picklist')).toBe('Xrm.Attributes.OptionSetAttribute');
  });

  it('should map State/Status to Xrm.Attributes.OptionSetAttribute', () => {
    expect(getFormAttributeType('State')).toBe('Xrm.Attributes.OptionSetAttribute');
    expect(getFormAttributeType('Status')).toBe('Xrm.Attributes.OptionSetAttribute');
  });

  it('should map EntityName to Xrm.Attributes.StringAttribute', () => {
    expect(getFormAttributeType('EntityName')).toBe('Xrm.Attributes.StringAttribute');
  });

  it('should map DateTime to Xrm.Attributes.DateAttribute', () => {
    expect(getFormAttributeType('DateTime')).toBe('Xrm.Attributes.DateAttribute');
  });

  it('should map Lookup/Customer/Owner/PartyList to Xrm.Attributes.LookupAttribute', () => {
    expect(getFormAttributeType('Lookup')).toBe('Xrm.Attributes.LookupAttribute');
    expect(getFormAttributeType('Customer')).toBe('Xrm.Attributes.LookupAttribute');
    expect(getFormAttributeType('Owner')).toBe('Xrm.Attributes.LookupAttribute');
    expect(getFormAttributeType('PartyList')).toBe('Xrm.Attributes.LookupAttribute');
  });

  it('should map MultiSelectPicklist to MultiSelectOptionSetAttribute', () => {
    expect(getFormAttributeType('MultiSelectPicklist')).toBe('Xrm.Attributes.MultiSelectOptionSetAttribute');
  });

  it('should return generic Attribute for unknown types', () => {
    expect(getFormAttributeType('SomeFutureType')).toBe('Xrm.Attributes.Attribute');
  });
});

// ─── Form Control Types ──────────────────────────────────────────────────────

describe('getFormControlType', () => {
  it('should map String/Memo to StringControl', () => {
    expect(getFormControlType('String')).toBe('Xrm.Controls.StringControl');
    expect(getFormControlType('Memo')).toBe('Xrm.Controls.StringControl');
  });

  it('should map numeric types to NumberControl', () => {
    expect(getFormControlType('Integer')).toBe('Xrm.Controls.NumberControl');
    expect(getFormControlType('BigInt')).toBe('Xrm.Controls.NumberControl');
    expect(getFormControlType('Decimal')).toBe('Xrm.Controls.NumberControl');
    expect(getFormControlType('Double')).toBe('Xrm.Controls.NumberControl');
    expect(getFormControlType('Money')).toBe('Xrm.Controls.NumberControl');
  });

  it('should map Boolean to StandardControl', () => {
    expect(getFormControlType('Boolean')).toBe('Xrm.Controls.StandardControl');
  });

  it('should map Picklist/State/Status to OptionSetControl', () => {
    expect(getFormControlType('Picklist')).toBe('Xrm.Controls.OptionSetControl');
    expect(getFormControlType('State')).toBe('Xrm.Controls.OptionSetControl');
    expect(getFormControlType('Status')).toBe('Xrm.Controls.OptionSetControl');
  });

  it('should map MultiSelectPicklist to MultiSelectOptionSetControl (R5-04)', () => {
    expect(getFormControlType('MultiSelectPicklist')).toBe('Xrm.Controls.MultiSelectOptionSetControl');
  });

  it('should map Lookup/Customer/Owner/PartyList to LookupControl', () => {
    expect(getFormControlType('Lookup')).toBe('Xrm.Controls.LookupControl');
    expect(getFormControlType('Customer')).toBe('Xrm.Controls.LookupControl');
    expect(getFormControlType('Owner')).toBe('Xrm.Controls.LookupControl');
    expect(getFormControlType('PartyList')).toBe('Xrm.Controls.LookupControl');
  });

  it('should map DateTime to DateControl', () => {
    expect(getFormControlType('DateTime')).toBe('Xrm.Controls.DateControl');
  });

  it('should return StandardControl for unknown types', () => {
    expect(getFormControlType('SomeFutureType')).toBe('Xrm.Controls.StandardControl');
  });
});

// ─── Identifier Utilities ────────────────────────────────────────────────────

describe('toSafeIdentifier', () => {
  it('should return valid identifiers unchanged', () => {
    expect(toSafeIdentifier('name')).toBe('name');
    expect(toSafeIdentifier('accountid')).toBe('accountid');
    expect(toSafeIdentifier('markant_cdhcontactsource')).toBe('markant_cdhcontactsource');
    expect(toSafeIdentifier('$field')).toBe('$field');
  });

  it('should replace invalid characters with underscore', () => {
    expect(toSafeIdentifier('field-name')).toBe('field_name');
    expect(toSafeIdentifier('field.name')).toBe('field_name');
  });

  it('should prefix with underscore if starts with digit', () => {
    expect(toSafeIdentifier('123field')).toBe('_123field');
  });

  it('should handle empty string', () => {
    expect(toSafeIdentifier('')).toBe('_unnamed');
  });
});

describe('toPascalCase', () => {
  it('should capitalize first letter', () => {
    expect(toPascalCase('account')).toBe('Account');
  });

  it('should capitalize each segment after underscore', () => {
    expect(toPascalCase('markant_cdhcontactsource')).toBe('MarkantCdhcontactsource');
  });

  it('should handle single character segments', () => {
    expect(toPascalCase('a_b_c')).toBe('ABC');
  });

  it('should handle already PascalCase', () => {
    expect(toPascalCase('Account')).toBe('Account');
  });
});

describe('toLookupValueProperty', () => {
  it('should wrap with _ prefix and _value suffix', () => {
    expect(toLookupValueProperty('primarycontactid')).toBe('_primarycontactid_value');
    expect(toLookupValueProperty('ownerid')).toBe('_ownerid_value');
    expect(toLookupValueProperty('parentaccountid')).toBe('_parentaccountid_value');
  });
});

describe('isLookupType', () => {
  it('should return true for lookup types', () => {
    expect(isLookupType('Lookup')).toBe(true);
    expect(isLookupType('Customer')).toBe(true);
    expect(isLookupType('Owner')).toBe(true);
    expect(isLookupType('PartyList')).toBe(false); // PartyList is NOT a lookup (it's a navigation property)
  });

  it('should return false for non-lookup types', () => {
    expect(isLookupType('String')).toBe(false);
    expect(isLookupType('Integer')).toBe(false);
    expect(isLookupType('Picklist')).toBe(false);
  });
});

// ─── shouldIncludeInEntityInterface ──────────────────────────────────────────

describe('shouldIncludeInEntityInterface', () => {
  function createAttr(overrides: Partial<AttributeMetadata>): AttributeMetadata {
    return {
      LogicalName: 'test',
      SchemaName: 'Test',
      AttributeType: 'String',
      DisplayName: { LocalizedLabels: [], UserLocalizedLabel: null },
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

  it('should include regular readable attributes', () => {
    expect(shouldIncludeInEntityInterface(createAttr({}))).toBe(true);
  });

  it('should exclude Virtual attributes', () => {
    expect(shouldIncludeInEntityInterface(createAttr({ AttributeType: 'Virtual' }))).toBe(false);
  });

  it('should exclude CalendarRules', () => {
    expect(shouldIncludeInEntityInterface(createAttr({ AttributeType: 'CalendarRules' }))).toBe(false);
  });

  it('should exclude attributes with IsValidForRead=false', () => {
    expect(shouldIncludeInEntityInterface(createAttr({ IsValidForRead: false }))).toBe(false);
  });

  it('should exclude ManagedProperty (solution metadata, not business data)', () => {
    expect(shouldIncludeInEntityInterface(createAttr({ AttributeType: 'ManagedProperty' }))).toBe(false);
  });

  it('should exclude EntityName (internal lookup companion fields)', () => {
    // EntityName fields like owneridtype are not standalone Web API properties.
    // Entity type info comes from @Microsoft.Dynamics.CRM.lookuplogicalname annotation.
    expect(shouldIncludeInEntityInterface(createAttr({ AttributeType: 'EntityName' }))).toBe(false);
  });

  it('should include attributes even if not valid for create/update', () => {
    expect(shouldIncludeInEntityInterface(createAttr({
      IsValidForCreate: false,
      IsValidForUpdate: false,
    }))).toBe(true);
  });
});
