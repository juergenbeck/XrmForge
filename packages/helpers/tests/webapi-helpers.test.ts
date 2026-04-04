import { describe, it, expect } from 'vitest';
import { select, selectExpand, parseLookup, parseLookups, parseFormattedValue } from '../src/webapi-helpers.js';

// select / selectExpand

describe('select', () => {
  it('should build $select query string', () => {
    expect(select('name', 'telephone1')).toBe('?$select=name,telephone1');
  });

  it('should return empty string for no fields', () => {
    expect(select()).toBe('');
  });
});

describe('selectExpand', () => {
  it('should build $select and $expand query string', () => {
    const result = selectExpand(['name'], 'primarycontactid($select=fullname)');
    expect(result).toBe('?$select=name&$expand=primarycontactid($select=fullname)');
  });
});

// parseLookup

describe('parseLookup', () => {
  const mockResponse: Record<string, unknown> = {
    'name': 'Contoso Ltd',
    '_parentaccountid_value': '00000000-0000-0000-0000-000000000001',
    '_parentaccountid_value@OData.Community.Display.V1.FormattedValue': 'Parent Corp',
    '_parentaccountid_value@Microsoft.Dynamics.CRM.lookuplogicalname': 'account',
    '_primarycontactid_value': 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    '_primarycontactid_value@OData.Community.Display.V1.FormattedValue': 'Max Mustermann',
    '_primarycontactid_value@Microsoft.Dynamics.CRM.lookuplogicalname': 'contact',
  };

  it('should parse a lookup with all annotations', () => {
    const result = parseLookup(mockResponse, 'parentaccountid');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('00000000-0000-0000-0000-000000000001');
    expect(result!.name).toBe('Parent Corp');
    expect(result!.entityType).toBe('account');
  });

  it('should parse a different lookup from the same response', () => {
    const result = parseLookup(mockResponse, 'primarycontactid');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(result!.name).toBe('Max Mustermann');
    expect(result!.entityType).toBe('contact');
  });

  it('should return null for empty lookup', () => {
    const result = parseLookup(mockResponse, 'ownerid');
    expect(result).toBeNull();
  });

  it('should return null for null value', () => {
    const response = { '_ownerid_value': null };
    const result = parseLookup(response, 'ownerid');
    expect(result).toBeNull();
  });

  it('should handle missing annotations gracefully', () => {
    const response = { '_ownerid_value': '12345678-1234-1234-1234-123456789012' };
    const result = parseLookup(response, 'ownerid');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('12345678-1234-1234-1234-123456789012');
    expect(result!.name).toBe('');
    expect(result!.entityType).toBe('');
  });

  it('should work with custom entity lookups (markant_ prefix)', () => {
    const response: Record<string, unknown> = {
      '_markant_address1_countryid_value': 'country-guid-123',
      '_markant_address1_countryid_value@OData.Community.Display.V1.FormattedValue': 'Deutschland',
      '_markant_address1_countryid_value@Microsoft.Dynamics.CRM.lookuplogicalname': 'markant_country',
    };

    const result = parseLookup(response, 'markant_address1_countryid');

    expect(result!.id).toBe('country-guid-123');
    expect(result!.name).toBe('Deutschland');
    expect(result!.entityType).toBe('markant_country');
  });
});

// parseLookups (batch)

describe('parseLookups', () => {
  it('should parse multiple lookups at once', () => {
    const response: Record<string, unknown> = {
      '_parentaccountid_value': 'acc-guid',
      '_parentaccountid_value@OData.Community.Display.V1.FormattedValue': 'Contoso',
      '_parentaccountid_value@Microsoft.Dynamics.CRM.lookuplogicalname': 'account',
      '_primarycontactid_value': 'con-guid',
      '_primarycontactid_value@OData.Community.Display.V1.FormattedValue': 'Max',
      '_primarycontactid_value@Microsoft.Dynamics.CRM.lookuplogicalname': 'contact',
    };

    const result = parseLookups(response, ['parentaccountid', 'primarycontactid', 'ownerid']);

    expect(result.parentaccountid).not.toBeNull();
    expect(result.parentaccountid!.name).toBe('Contoso');
    expect(result.primarycontactid).not.toBeNull();
    expect(result.primarycontactid!.name).toBe('Max');
    expect(result.ownerid).toBeNull();
  });
});

// parseFormattedValue

describe('parseFormattedValue', () => {
  it('should return formatted value for option sets', () => {
    const response: Record<string, unknown> = {
      'statecode': 0,
      'statecode@OData.Community.Display.V1.FormattedValue': 'Active',
    };

    expect(parseFormattedValue(response, 'statecode')).toBe('Active');
  });

  it('should return formatted value for date fields', () => {
    const response: Record<string, unknown> = {
      'createdon': '2026-03-30T14:00:00Z',
      'createdon@OData.Community.Display.V1.FormattedValue': '30.03.2026 16:00',
    };

    expect(parseFormattedValue(response, 'createdon')).toBe('30.03.2026 16:00');
  });

  it('should return null when no formatted value exists', () => {
    const response: Record<string, unknown> = { 'name': 'Contoso' };
    expect(parseFormattedValue(response, 'name')).toBeNull();
  });
});
