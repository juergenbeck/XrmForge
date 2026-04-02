import { describe, it, expect } from 'vitest';
import { WebApiError } from '../src/error.js';

describe('WebApiError', () => {
  it('should create with message', () => {
    const err = new WebApiError('Not found', 404, '0x80040217');
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err.errorCode).toBe('0x80040217');
    expect(err.name).toBe('WebApiError');
  });

  it('should be instanceof Error', () => {
    const err = new WebApiError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(WebApiError);
  });

  it('should create from Xrm error object', () => {
    const xrmError = {
      message: 'Entity not found',
      errorCode: 404,
      code: '0x80040217',
      innererror: { message: 'Contact with id xyz does not exist' },
    };
    const err = WebApiError.fromXrmError(xrmError);
    expect(err.message).toBe('Entity not found');
    expect(err.statusCode).toBe(404);
    expect(err.innerMessage).toBe('Contact with id xyz does not exist');
  });

  it('should handle string errors', () => {
    const err = WebApiError.fromXrmError('Something went wrong');
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(0);
  });

  it('should return same instance for WebApiError input', () => {
    const original = new WebApiError('test', 500);
    const result = WebApiError.fromXrmError(original);
    expect(result).toBe(original);
  });
});
