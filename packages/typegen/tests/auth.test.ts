import { describe, it, expect, vi, afterEach } from 'vitest';
import { createCredential } from '../src/auth/credential.js';
import { AuthenticationError } from '../src/errors.js';
import type { AuthConfig } from '../src/auth/credential.js';
import { configureLogging, SilentLogSink } from '../src/logger.js';

// Suppress log output during tests
configureLogging({ sink: new SilentLogSink() });

// ─── Client Credentials Validation ──────────────────────────────────────────

describe('createCredential - client-credentials', () => {
  it('should create a credential with valid config', () => {
    const config: AuthConfig = {
      method: 'client-credentials',
      tenantId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      clientId: '11111111-2222-3333-4444-555555555555',
      clientSecret: 'super-secret-value',
    };

    const credential = createCredential(config);
    expect(credential).toBeDefined();
    expect(credential.getToken).toBeDefined();
  });

  it('should throw when tenantId is missing', () => {
    const config: AuthConfig = {
      method: 'client-credentials',
      tenantId: '',
      clientId: '11111111-2222-3333-4444-555555555555',
      clientSecret: 'secret',
    };

    expect(() => createCredential(config)).toThrow(AuthenticationError);
  });

  it('should throw when clientId is missing', () => {
    const config: AuthConfig = {
      method: 'client-credentials',
      tenantId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      clientId: '',
      clientSecret: 'secret',
    };

    expect(() => createCredential(config)).toThrow(AuthenticationError);
  });

  it('should throw when clientSecret is missing', () => {
    const config: AuthConfig = {
      method: 'client-credentials',
      tenantId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      clientId: '11111111-2222-3333-4444-555555555555',
      clientSecret: '',
    };

    expect(() => createCredential(config)).toThrow(AuthenticationError);
  });

  it('should list all missing fields in error', () => {
    const config: AuthConfig = {
      method: 'client-credentials',
      tenantId: '',
      clientId: '',
      clientSecret: '',
    };

    try {
      createCredential(config);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AuthenticationError);
      const authError = error as AuthenticationError;
      expect(authError.message).toContain('tenantId');
      expect(authError.message).toContain('clientId');
      expect(authError.message).toContain('clientSecret');
      expect(authError.context.missingFields).toEqual(['tenantId', 'clientId', 'clientSecret']);
    }
  });

  it('should reject whitespace-only values', () => {
    const config: AuthConfig = {
      method: 'client-credentials',
      tenantId: '   ',
      clientId: '\t',
      clientSecret: '\n',
    };

    expect(() => createCredential(config)).toThrow(AuthenticationError);
  });
});

// ─── Interactive ─────────────────────────────────────────────────────────────

describe('createCredential - interactive', () => {
  it('should create a credential without optional fields', () => {
    const config: AuthConfig = {
      method: 'interactive',
    };

    const credential = createCredential(config);
    expect(credential).toBeDefined();
    expect(credential.getToken).toBeDefined();
  });

  it('should create a credential with custom clientId', () => {
    const config: AuthConfig = {
      method: 'interactive',
      tenantId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      clientId: '11111111-2222-3333-4444-555555555555',
    };

    const credential = createCredential(config);
    expect(credential).toBeDefined();
  });
});

// ─── Device Code ─────────────────────────────────────────────────────────────

describe('createCredential - device-code', () => {
  it('should create a credential without optional fields', () => {
    const config: AuthConfig = {
      method: 'device-code',
    };

    const credential = createCredential(config);
    expect(credential).toBeDefined();
    expect(credential.getToken).toBeDefined();
  });

  it('should create a credential with custom clientId', () => {
    const config: AuthConfig = {
      method: 'device-code',
      tenantId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      clientId: '11111111-2222-3333-4444-555555555555',
    };

    const credential = createCredential(config);
    expect(credential).toBeDefined();
  });
});

// ─── Exhaustiveness ──────────────────────────────────────────────────────────

describe('createCredential - unknown method', () => {
  it('should throw AuthenticationError for unknown methods', () => {
    const config = {
      method: 'unknown-method',
    } as unknown as AuthConfig;

    expect(() => createCredential(config)).toThrow(AuthenticationError);
  });
});
