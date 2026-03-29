import { describe, it, expect } from 'vitest';
import { DataverseHttpClient } from '../src/http/client.js';
import { ApiRequestError } from '../src/errors.js';

// ─── sanitizeIdentifier ──────────────────────────────────────────────────────

describe('DataverseHttpClient.sanitizeIdentifier', () => {
  it('should accept valid entity names', () => {
    expect(DataverseHttpClient.sanitizeIdentifier('contact')).toBe('contact');
    expect(DataverseHttpClient.sanitizeIdentifier('markant_cdhcontactsource')).toBe(
      'markant_cdhcontactsource',
    );
    expect(DataverseHttpClient.sanitizeIdentifier('Account')).toBe('Account');
    expect(DataverseHttpClient.sanitizeIdentifier('_private')).toBe('_private');
  });

  it('should accept identifiers with numbers (not at start)', () => {
    expect(DataverseHttpClient.sanitizeIdentifier('field1')).toBe('field1');
    expect(DataverseHttpClient.sanitizeIdentifier('markant_v2_contact')).toBe(
      'markant_v2_contact',
    );
  });

  it('should reject identifiers starting with a number', () => {
    expect(() => DataverseHttpClient.sanitizeIdentifier('123abc')).toThrow(ApiRequestError);
  });

  it('should reject identifiers with spaces', () => {
    expect(() => DataverseHttpClient.sanitizeIdentifier('my entity')).toThrow(ApiRequestError);
  });

  it('should reject identifiers with special characters', () => {
    expect(() => DataverseHttpClient.sanitizeIdentifier("contact' OR 1=1--")).toThrow(
      ApiRequestError,
    );
    expect(() => DataverseHttpClient.sanitizeIdentifier('entity;DROP')).toThrow(ApiRequestError);
    expect(() => DataverseHttpClient.sanitizeIdentifier('field.name')).toThrow(ApiRequestError);
    expect(() => DataverseHttpClient.sanitizeIdentifier('entity/path')).toThrow(ApiRequestError);
  });

  it('should reject empty strings', () => {
    expect(() => DataverseHttpClient.sanitizeIdentifier('')).toThrow(ApiRequestError);
  });

  it('should reject identifiers with parentheses (OData injection)', () => {
    expect(() => DataverseHttpClient.sanitizeIdentifier('contacts(guid)')).toThrow(
      ApiRequestError,
    );
  });
});

// ─── sanitizeGuid ────────────────────────────────────────────────────────────

describe('DataverseHttpClient.sanitizeGuid', () => {
  it('should accept valid GUIDs', () => {
    const guid = '12345678-1234-1234-1234-123456789abc';
    expect(DataverseHttpClient.sanitizeGuid(guid)).toBe(guid);
  });

  it('should accept uppercase GUIDs', () => {
    const guid = 'ABCDEF12-3456-7890-ABCD-EF1234567890';
    expect(DataverseHttpClient.sanitizeGuid(guid)).toBe(guid);
  });

  it('should accept mixed case GUIDs', () => {
    const guid = 'aB12cD34-eF56-7890-AbCd-Ef1234567890';
    expect(DataverseHttpClient.sanitizeGuid(guid)).toBe(guid);
  });

  it('should reject GUIDs with braces', () => {
    expect(() =>
      DataverseHttpClient.sanitizeGuid('{12345678-1234-1234-1234-123456789abc}'),
    ).toThrow(ApiRequestError);
  });

  it('should reject malformed GUIDs', () => {
    expect(() => DataverseHttpClient.sanitizeGuid('not-a-guid')).toThrow(ApiRequestError);
    expect(() => DataverseHttpClient.sanitizeGuid('12345678123412341234123456789abc')).toThrow(
      ApiRequestError,
    );
    expect(() => DataverseHttpClient.sanitizeGuid('')).toThrow(ApiRequestError);
  });

  it('should reject GUIDs with injection attempts', () => {
    expect(() =>
      DataverseHttpClient.sanitizeGuid("12345678-1234-1234-1234-123456789abc' OR 1=1--"),
    ).toThrow(ApiRequestError);
  });

  it('should reject GUIDs with wrong segment lengths', () => {
    // Missing a digit in first segment
    expect(() => DataverseHttpClient.sanitizeGuid('1234567-1234-1234-1234-123456789abc')).toThrow(
      ApiRequestError,
    );
  });
});

// ─── escapeODataString ───────────────────────────────────────────────────────

describe('DataverseHttpClient.escapeODataString', () => {
  it('should return strings without quotes unchanged', () => {
    expect(DataverseHttpClient.escapeODataString('hello world')).toBe('hello world');
  });

  it('should double single quotes', () => {
    expect(DataverseHttpClient.escapeODataString("it's")).toBe("it''s");
  });

  it('should handle multiple single quotes', () => {
    expect(DataverseHttpClient.escapeODataString("a'b'c")).toBe("a''b''c");
  });

  it('should handle empty strings', () => {
    expect(DataverseHttpClient.escapeODataString('')).toBe('');
  });

  it('should not modify double quotes', () => {
    expect(DataverseHttpClient.escapeODataString('say "hello"')).toBe('say "hello"');
  });

  it('should handle strings that are only quotes', () => {
    expect(DataverseHttpClient.escapeODataString("'''")).toBe("''''''");
  });
});
