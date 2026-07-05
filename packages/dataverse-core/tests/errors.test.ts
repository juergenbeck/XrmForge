import { describe, it, expect } from 'vitest';
import { DataverseError, DataverseHttpError, isDataverseError } from '../src/errors.js';

describe('DataverseError', () => {
  it('prefixes the message with the code and preserves context', () => {
    const err = new DataverseError('INVALID_GUID', 'bad value', { value: 'x' });
    expect(err.message).toBe('[INVALID_GUID] bad value');
    expect(err.code).toBe('INVALID_GUID');
    expect(err.context).toEqual({ value: 'x' });
    expect(err.name).toBe('DataverseError');
    expect(err).toBeInstanceOf(Error);
    expect(isDataverseError(err)).toBe(true);
  });

  it('defaults context to an empty object', () => {
    const err = new DataverseError('ABORTED', 'stopped');
    expect(err.context).toEqual({});
  });
});

describe('DataverseHttpError', () => {
  it('exposes statusCode and responseBody taken from context', () => {
    const err = new DataverseHttpError('REQUEST_FAILED', 'server said no', {
      statusCode: 400,
      responseBody: '{"error":{}}',
      url: 'https://org/api/data/v9.2/accounts',
    });
    expect(err.statusCode).toBe(400);
    expect(err.responseBody).toBe('{"error":{}}');
    expect(err.name).toBe('DataverseHttpError');
    expect(err).toBeInstanceOf(DataverseError);
    expect(isDataverseError(err)).toBe(true);
  });

  it('leaves statusCode undefined when not provided (network/timeout)', () => {
    const err = new DataverseHttpError('TIMEOUT', 'timed out');
    expect(err.statusCode).toBeUndefined();
    expect(err.responseBody).toBeUndefined();
  });
});

describe('isDataverseError', () => {
  it('returns false for unrelated values', () => {
    expect(isDataverseError(new Error('plain'))).toBe(false);
    expect(isDataverseError('string')).toBe(false);
    expect(isDataverseError(null)).toBe(false);
    expect(isDataverseError(undefined)).toBe(false);
  });
});
