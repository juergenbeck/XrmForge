import { describe, it, expect } from 'vitest';
import { select, selectExpand, expanded, expandedMany, parseLookup, parseLookups, parseFormattedValue, parseMultiSelect, formLookup, formLookupId, formLookupIdUnsafe, formLookupUnsafe } from '../src/webapi-helpers.js';

// select / selectExpand

describe('select', () => {
  it('should build $select query string (variadic)', () => {
    expect(select('name', 'telephone1')).toBe('?$select=name,telephone1');
  });

  it('should build $select query string (array overload)', () => {
    expect(select(['name', 'telephone1'])).toBe('?$select=name,telephone1');
  });

  it('should return empty string for no fields', () => {
    expect(select()).toBe('');
  });

  it('should return empty string for empty array', () => {
    expect(select([])).toBe('');
  });

  it('should handle single field (variadic)', () => {
    expect(select('name')).toBe('?$select=name');
  });

  it('should handle single field (array)', () => {
    expect(select(['name'])).toBe('?$select=name');
  });
});

describe('selectExpand', () => {
  it('should build $select and $expand query string', () => {
    const result = selectExpand(['name'], 'primarycontactid($select=fullname)');
    expect(result).toBe('?$select=name&$expand=primarycontactid($select=fullname)');
  });
});

// expanded / expandedMany (F-MK9-08)

interface Contact { fullname?: string; emailaddress1?: string }

describe('expanded', () => {
  it('should return the single expanded nav object as Partial<T>', () => {
    const response: Record<string, unknown> = {
      name: 'Contoso',
      primarycontactid: { fullname: 'Max Mustermann' },
    };
    const contact = expanded<Contact>(response, 'primarycontactid');
    expect(contact).not.toBeNull();
    expect(contact!.fullname).toBe('Max Mustermann');
  });

  it('should return null when the nav property is absent', () => {
    expect(expanded<Contact>({ name: 'Contoso' }, 'primarycontactid')).toBeNull();
  });

  it('should return null when the nav property is explicitly null', () => {
    expect(expanded<Contact>({ primarycontactid: null }, 'primarycontactid')).toBeNull();
  });

  it('should return null when the nav property is an array (use expandedMany)', () => {
    expect(expanded<Contact>({ contacts: [{ fullname: 'A' }] }, 'contacts')).toBeNull();
  });
});

describe('expandedMany', () => {
  it('should return the expanded collection as Partial<T>[]', () => {
    const response: Record<string, unknown> = {
      name: 'Contoso',
      contact_customer_accounts: [{ fullname: 'A' }, { fullname: 'B' }],
    };
    const contacts = expandedMany<Contact>(response, 'contact_customer_accounts');
    expect(contacts).toHaveLength(2);
    expect(contacts[0]!.fullname).toBe('A');
  });

  it('should return an empty array when the nav property is absent', () => {
    expect(expandedMany<Contact>({ name: 'Contoso' }, 'contact_customer_accounts')).toEqual([]);
  });

  it('should return an empty array when the nav property is not an array', () => {
    expect(expandedMany<Contact>({ x: { fullname: 'A' } }, 'x')).toEqual([]);
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

// ─── formLookup ─────────────────────────────────────────────────────────────

describe('formLookup', () => {
  it('should extract first lookup value with normalized id', () => {
    const attr = {
      getValue: () => [{ id: '{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}', name: 'Contoso', entityType: 'account' }],
    };
    const result = formLookup(attr);
    expect(result).toEqual({
      id: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
      name: 'Contoso',
      entityType: 'account',
    });
  });

  it('should return null for empty array', () => {
    const attr = { getValue: () => [] };
    expect(formLookup(attr)).toBeNull();
  });

  it('should return null for null value', () => {
    const attr = { getValue: () => null };
    expect(formLookup(attr)).toBeNull();
  });

  it('should handle missing name', () => {
    const attr = {
      getValue: () => [{ id: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890', entityType: 'contact' }],
    };
    const result = formLookup(attr as Parameters<typeof formLookup>[0]);
    expect(result!.name).toBe('');
  });

  it('should handle id without braces', () => {
    const attr = {
      getValue: () => [{ id: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890', name: 'Test', entityType: 'account' }],
    };
    expect(formLookup(attr)!.id).toBe('A1B2C3D4-E5F6-7890-ABCD-EF1234567890');
  });
});

// ─── formLookupId ───────────────────────────────────────────────────────────

describe('formLookupId', () => {
  it('should return normalized id', () => {
    const attr = {
      getValue: () => [{ id: '{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}' }],
    };
    expect(formLookupId(attr)).toBe('A1B2C3D4-E5F6-7890-ABCD-EF1234567890');
  });

  it('should return null for empty lookup', () => {
    const attr = { getValue: () => [] };
    expect(formLookupId(attr)).toBeNull();
  });

  it('should return null for null value', () => {
    const attr = { getValue: () => null };
    expect(formLookupId(attr)).toBeNull();
  });
});

// ─── parseMultiSelect ───────────────────────────────────────────────────────

describe('parseMultiSelect', () => {
  it('parses a comma-separated Web API string', () => {
    expect(parseMultiSelect('595300000,595300001')).toEqual([595300000, 595300001]);
  });

  it('passes through a number array', () => {
    expect(parseMultiSelect([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('wraps a single number', () => {
    expect(parseMultiSelect(7)).toEqual([7]);
  });

  it('returns [] for null/undefined by default', () => {
    expect(parseMultiSelect(null)).toEqual([]);
    expect(parseMultiSelect(undefined)).toEqual([]);
  });

  it('drops empty parts from a trailing comma (no spurious 0)', () => {
    expect(parseMultiSelect('1,2,')).toEqual([1, 2]);
    expect(parseMultiSelect(' 1 , 2 ')).toEqual([1, 2]);
  });

  it('returns null for empty input when emptyAsNull is true', () => {
    expect(parseMultiSelect(null, true)).toBeNull();
    expect(parseMultiSelect('', true)).toBeNull();
    expect(parseMultiSelect([], true)).toBeNull();
  });

  it('returns the array (not null) for non-empty input when emptyAsNull is true', () => {
    expect(parseMultiSelect('1,2', true)).toEqual([1, 2]);
  });
});

// ─── formLookupIdUnsafe / formLookupUnsafe ───────────────────────────────────

describe('formLookupIdUnsafe', () => {
  it('reads an off-form lookup id via $unsafe (normalized, no braces)', () => {
    const attr = { getValue: () => [{ id: '{A1B2C3D4-0000-0000-0000-000000000000}' }] };
    const $unsafe = (name: string) => (name === 'parentaccountid' ? attr : null);

    expect(formLookupIdUnsafe({ $unsafe } as Parameters<typeof formLookupIdUnsafe>[0], 'parentaccountid')).toBe(
      'A1B2C3D4-0000-0000-0000-000000000000',
    );
  });

  it('returns null when the off-form field is absent', () => {
    const $unsafe = () => null;
    expect(formLookupIdUnsafe({ $unsafe }, 'missing')).toBeNull();
  });

  it('returns null when the lookup is empty', () => {
    const $unsafe = () => ({ getValue: () => null });
    expect(formLookupIdUnsafe({ $unsafe } as Parameters<typeof formLookupIdUnsafe>[0], 'empty')).toBeNull();
  });
});

describe('formLookupUnsafe', () => {
  it('reads the full off-form lookup value via $unsafe', () => {
    const attr = {
      getValue: () => [{ id: '{A1-B2}', name: 'Acme', entityType: 'account' }],
    };
    const $unsafe = () => attr;

    const result = formLookupUnsafe({ $unsafe } as Parameters<typeof formLookupUnsafe>[0], 'parentaccountid');
    expect(result).toEqual({ id: 'A1-B2', name: 'Acme', entityType: 'account' });
  });

  it('returns null when the off-form field is absent', () => {
    const $unsafe = () => null;
    expect(formLookupUnsafe({ $unsafe }, 'missing')).toBeNull();
  });
});
