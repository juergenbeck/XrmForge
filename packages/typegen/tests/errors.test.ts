import { describe, it, expect } from 'vitest';
import {
  XrmForgeError,
  AuthenticationError,
  ApiRequestError,
  MetadataError,
  GenerationError,
  ConfigError,
  ErrorCode,
  isXrmForgeError,
  isRateLimitError,
} from '../src/errors.js';

// ─── Error Construction ──────────────────────────────────────────────────────

describe('XrmForgeError', () => {
  it('should create an error with code and message', () => {
    const error = new XrmForgeError(ErrorCode.CONFIG_INVALID, 'bad config');
    expect(error.message).toBe('[CONFIG_5001] bad config');
    expect(error.code).toBe(ErrorCode.CONFIG_INVALID);
    expect(error.name).toBe('XrmForgeError');
    expect(error.context).toEqual({});
  });

  it('should carry context', () => {
    const ctx = { file: 'xrmforge.config.json', line: 42 };
    const error = new XrmForgeError(ErrorCode.CONFIG_INVALID, 'bad config', ctx);
    expect(error.context).toEqual(ctx);
  });

  it('should be an instance of Error', () => {
    const error = new XrmForgeError(ErrorCode.CONFIG_INVALID, 'test');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(XrmForgeError);
  });

  it('should have a stack trace', () => {
    const error = new XrmForgeError(ErrorCode.CONFIG_INVALID, 'test');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('errors.test.ts');
  });
});

// ─── Subclasses ──────────────────────────────────────────────────────────────

describe('AuthenticationError', () => {
  it('should set name to AuthenticationError', () => {
    const error = new AuthenticationError(ErrorCode.AUTH_MISSING_CONFIG, 'missing');
    expect(error.name).toBe('AuthenticationError');
    expect(error).toBeInstanceOf(XrmForgeError);
    expect(error).toBeInstanceOf(AuthenticationError);
  });
});

describe('ApiRequestError', () => {
  it('should expose statusCode and responseBody', () => {
    const error = new ApiRequestError(ErrorCode.API_REQUEST_FAILED, 'fail', {
      statusCode: 500,
      responseBody: '{"error":"internal"}',
      url: 'https://org.crm4.dynamics.com/api/data/v9.2/contacts',
    });
    expect(error.name).toBe('ApiRequestError');
    expect(error.statusCode).toBe(500);
    expect(error.responseBody).toBe('{"error":"internal"}');
    expect(error.context.url).toBe('https://org.crm4.dynamics.com/api/data/v9.2/contacts');
  });

  it('should handle missing optional fields', () => {
    const error = new ApiRequestError(ErrorCode.API_NOT_FOUND, 'not found');
    expect(error.statusCode).toBeUndefined();
    expect(error.responseBody).toBeUndefined();
  });
});

describe('MetadataError', () => {
  it('should set name to MetadataError', () => {
    const error = new MetadataError(ErrorCode.META_ENTITY_NOT_FOUND, 'not found');
    expect(error.name).toBe('MetadataError');
    expect(error).toBeInstanceOf(XrmForgeError);
  });
});

describe('GenerationError', () => {
  it('should set name to GenerationError', () => {
    const error = new GenerationError(ErrorCode.GEN_OUTPUT_WRITE_FAILED, 'write failed');
    expect(error.name).toBe('GenerationError');
    expect(error).toBeInstanceOf(XrmForgeError);
  });
});

describe('ConfigError', () => {
  it('should set name to ConfigError', () => {
    const error = new ConfigError(ErrorCode.CONFIG_FILE_NOT_FOUND, 'not found');
    expect(error.name).toBe('ConfigError');
    expect(error).toBeInstanceOf(XrmForgeError);
  });
});

// ─── Type Guards ─────────────────────────────────────────────────────────────

describe('isXrmForgeError', () => {
  it('should return true for XrmForgeError', () => {
    expect(isXrmForgeError(new XrmForgeError(ErrorCode.CONFIG_INVALID, 'x'))).toBe(true);
  });

  it('should return true for subclasses', () => {
    expect(isXrmForgeError(new AuthenticationError(ErrorCode.AUTH_TOKEN_FAILED, 'x'))).toBe(true);
    expect(isXrmForgeError(new ApiRequestError(ErrorCode.API_TIMEOUT, 'x'))).toBe(true);
    expect(isXrmForgeError(new MetadataError(ErrorCode.META_ENTITY_NOT_FOUND, 'x'))).toBe(true);
    expect(isXrmForgeError(new GenerationError(ErrorCode.GEN_TEMPLATE_FAILED, 'x'))).toBe(true);
    expect(isXrmForgeError(new ConfigError(ErrorCode.CONFIG_INVALID, 'x'))).toBe(true);
  });

  it('should return false for plain Error', () => {
    expect(isXrmForgeError(new Error('plain'))).toBe(false);
  });

  it('should return false for non-errors', () => {
    expect(isXrmForgeError(null)).toBe(false);
    expect(isXrmForgeError(undefined)).toBe(false);
    expect(isXrmForgeError('string')).toBe(false);
    expect(isXrmForgeError(42)).toBe(false);
    expect(isXrmForgeError({})).toBe(false);
  });
});

describe('isRateLimitError', () => {
  it('should return true for API_RATE_LIMITED ApiRequestError', () => {
    const error = new ApiRequestError(ErrorCode.API_RATE_LIMITED, 'throttled');
    expect(isRateLimitError(error)).toBe(true);
  });

  it('should return false for other ApiRequestError codes', () => {
    const error = new ApiRequestError(ErrorCode.API_REQUEST_FAILED, 'fail');
    expect(isRateLimitError(error)).toBe(false);
  });

  it('should return false for non-ApiRequestError', () => {
    const error = new XrmForgeError(ErrorCode.API_RATE_LIMITED, 'wrong class');
    expect(isRateLimitError(error)).toBe(false);
  });

  it('should return false for non-errors', () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError('string')).toBe(false);
  });
});

// ─── ErrorCode Enum ──────────────────────────────────────────────────────────

describe('ErrorCode', () => {
  it('should have unique values', () => {
    const values = Object.values(ErrorCode);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('should follow naming convention (PREFIX_NNNN)', () => {
    for (const value of Object.values(ErrorCode)) {
      expect(value).toMatch(/^[A-Z]+_\d{4}$/);
    }
  });
});
