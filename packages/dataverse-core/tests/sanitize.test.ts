import { describe, it, expect } from 'vitest';
import { sanitizeIdentifier, sanitizeGuid, escapeODataString } from '../src/sanitize.js';
import { DataverseError } from '../src/errors.js';

describe('sanitizeIdentifier', () => {
  it('accepts valid identifiers unchanged', () => {
    expect(sanitizeIdentifier('accounts')).toBe('accounts');
    expect(sanitizeIdentifier('_value')).toBe('_value');
    expect(sanitizeIdentifier('new_field1')).toBe('new_field1');
    expect(sanitizeIdentifier('A')).toBe('A');
  });

  it('rejects injection attempts and invalid characters', () => {
    expect(() => sanitizeIdentifier("accounts');drop")).toThrow(DataverseError);
    expect(() => sanitizeIdentifier('1leading_digit')).toThrow(DataverseError);
    expect(() => sanitizeIdentifier('has space')).toThrow(DataverseError);
    expect(() => sanitizeIdentifier('dash-name')).toThrow(DataverseError);
    expect(() => sanitizeIdentifier('')).toThrow(DataverseError);
  });

  it('carries the INVALID_IDENTIFIER code and strips CR/LF from the echoed value', () => {
    let caught: unknown;
    try {
      sanitizeIdentifier('bad\r\nvalue');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(DataverseError);
    expect((caught as DataverseError).code).toBe('INVALID_IDENTIFIER');
    expect((caught as DataverseError).message).not.toContain('\n');
    expect((caught as DataverseError).message).not.toContain('\r');
  });

  it('truncates an over-long value in the error message', () => {
    const long = 'x'.repeat(500);
    let caught: unknown;
    try {
      sanitizeIdentifier(`${long} bad`);
    } catch (error) {
      caught = error;
    }
    // The echoed value is capped well below the raw input length.
    expect((caught as DataverseError).message.length).toBeLessThan(300);
  });
});

describe('sanitizeGuid', () => {
  it('accepts valid GUIDs (any hex case) unchanged', () => {
    const g = '00000000-0000-0000-0000-000000000000';
    expect(sanitizeGuid(g)).toBe(g);
    expect(sanitizeGuid('A1B2C3D4-e5f6-7890-ABCD-1234567890ef')).toBe(
      'A1B2C3D4-e5f6-7890-ABCD-1234567890ef',
    );
  });

  it('rejects malformed GUIDs', () => {
    expect(() => sanitizeGuid('not-a-guid')).toThrow(DataverseError);
    expect(() => sanitizeGuid('00000000000000000000000000000000')).toThrow(DataverseError);
    expect(() => sanitizeGuid('00000000-0000-0000-0000-00000000000g')).toThrow(DataverseError);
    expect(() => sanitizeGuid('')).toThrow(DataverseError);
  });

  it('carries the INVALID_GUID code', () => {
    let caught: unknown;
    try {
      sanitizeGuid('nope');
    } catch (error) {
      caught = error;
    }
    expect((caught as DataverseError).code).toBe('INVALID_GUID');
  });
});

describe('escapeODataString', () => {
  it('doubles single quotes', () => {
    expect(escapeODataString("O'Brien")).toBe("O''Brien");
    expect(escapeODataString("a'b'c")).toBe("a''b''c");
    expect(escapeODataString("'")).toBe("''");
  });

  it('leaves quote-free strings unchanged', () => {
    expect(escapeODataString('clean value')).toBe('clean value');
    expect(escapeODataString('')).toBe('');
  });
});
