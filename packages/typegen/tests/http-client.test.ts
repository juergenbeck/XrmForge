import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataverseHttpClient } from '../src/http/client.js';
import type { HttpClientOptions } from '../src/http/client.js';
import { ApiRequestError, AuthenticationError, ErrorCode } from '../src/errors.js';
import { configureLogging, SilentLogSink, ConsoleLogSink, LogLevel } from '../src/logger.js';
import type { TokenCredential, AccessToken, GetTokenOptions } from '@azure/identity';

// Suppress log output during tests
beforeEach(() => configureLogging({ sink: new SilentLogSink() }));
afterEach(() => configureLogging({ sink: new ConsoleLogSink(), minLevel: LogLevel.INFO }));

// ─── Mock Helpers ────────────────────────────────────────────────────────────

/** Creates a mock TokenCredential that returns a valid token */
function createMockCredential(overrides?: Partial<AccessToken>): TokenCredential {
  return {
    getToken: vi.fn<[string | string[], GetTokenOptions?], Promise<AccessToken>>().mockResolvedValue({
      token: 'mock-token-abc123',
      expiresOnTimestamp: Date.now() + 60 * 60 * 1000, // 1 hour from now
      ...overrides,
    }),
  };
}

/** Creates a mock Response object */
function createMockResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  const headerMap = new Headers(headers);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 429 ? 'Too Many Requests' : status === 500 ? 'Internal Server Error' : 'Error',
    headers: headerMap,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

/** Default client options for tests (fast retries, no real delays) */
function createTestOptions(overrides?: Partial<HttpClientOptions>): HttpClientOptions {
  return {
    environmentUrl: 'https://testorg.crm4.dynamics.com',
    credential: createMockCredential(),
    maxRetries: 2,
    retryBaseDelayMs: 1, // 1ms to avoid slow tests
    timeoutMs: 5000,
    maxConcurrency: 2,
    maxPages: 3,
    maxRateLimitRetries: 3,
    ...overrides,
  };
}

// ─── Construction & URL ──────────────────────────────────────────────────────

describe('DataverseHttpClient construction', () => {
  it('should build correct apiUrl', () => {
    const client = new DataverseHttpClient(createTestOptions());
    expect(client.apiUrl).toBe('https://testorg.crm4.dynamics.com/api/data/v9.2');
  });

  it('should strip trailing slash from environmentUrl', () => {
    const client = new DataverseHttpClient(createTestOptions({
      environmentUrl: 'https://testorg.crm4.dynamics.com/',
    }));
    expect(client.apiUrl).toBe('https://testorg.crm4.dynamics.com/api/data/v9.2');
  });

  it('should use custom apiVersion', () => {
    const client = new DataverseHttpClient(createTestOptions({ apiVersion: 'v9.1' }));
    expect(client.apiUrl).toBe('https://testorg.crm4.dynamics.com/api/data/v9.1');
  });
});

// ─── Successful GET ──────────────────────────────────────────────────────────

describe('DataverseHttpClient.get', () => {
  it('should make a successful GET request', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse(200, { value: [{ id: '1', name: 'Account' }] }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions());
    const result = await client.get<{ value: Array<{ id: string; name: string }> }>('/contacts');

    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.name).toBe('Account');

    // Verify correct URL
    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toBe('https://testorg.crm4.dynamics.com/api/data/v9.2/contacts');

    // Verify headers
    const calledOptions = mockFetch.mock.calls[0]![1] as RequestInit;
    const headers = calledOptions.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer mock-token-abc123');
    expect(headers['OData-Version']).toBe('4.0');

    vi.unstubAllGlobals();
  });

  it('should resolve absolute URLs directly', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockResponse(200, { value: [] }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions());
    await client.get('https://other.crm.dynamics.com/api/data/v9.2/contacts');

    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toBe('https://other.crm.dynamics.com/api/data/v9.2/contacts');

    vi.unstubAllGlobals();
  });
});

// ─── Token Caching ───────────────────────────────────────────────────────────

describe('Token caching', () => {
  it('should cache token across multiple requests', async () => {
    const credential = createMockCredential();
    const mockFetch = vi.fn().mockResolvedValue(createMockResponse(200, { ok: true }));
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions({ credential }));

    await client.get('/contacts');
    await client.get('/accounts');
    await client.get('/leads');

    // getToken should be called only once (cached for subsequent calls)
    expect(credential.getToken).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });

  it('should re-acquire token when expired', async () => {
    const credential = createMockCredential({
      // Token expires in 1 minute (less than 5-minute buffer)
      expiresOnTimestamp: Date.now() + 60 * 1000,
    });
    const mockFetch = vi.fn().mockResolvedValue(createMockResponse(200, { ok: true }));
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions({ credential }));

    await client.get('/contacts');
    await client.get('/accounts');

    // getToken should be called twice (token within buffer zone)
    expect(credential.getToken).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });

  it('should request token with correct scope', async () => {
    const credential = createMockCredential();
    const mockFetch = vi.fn().mockResolvedValue(createMockResponse(200, { ok: true }));
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions({ credential }));
    await client.get('/contacts');

    expect(credential.getToken).toHaveBeenCalledWith('https://testorg.crm4.dynamics.com/.default');

    vi.unstubAllGlobals();
  });
});

// ─── Token Errors ────────────────────────────────────────────────────────────

describe('Token error handling', () => {
  it('should throw AuthenticationError when getToken fails', async () => {
    const credential: TokenCredential = {
      getToken: vi.fn().mockRejectedValue(new Error('AADSTS700016: Application not found')),
    };

    const client = new DataverseHttpClient(createTestOptions({ credential }));

    await expect(client.get('/contacts')).rejects.toThrow(AuthenticationError);
    await expect(client.get('/contacts')).rejects.toThrow(/Failed to acquire access token/);
  });

  it('should throw AuthenticationError when getToken returns null', async () => {
    const credential: TokenCredential = {
      getToken: vi.fn().mockResolvedValue(null),
    };

    const client = new DataverseHttpClient(createTestOptions({ credential }));

    await expect(client.get('/contacts')).rejects.toThrow(AuthenticationError);
    await expect(client.get('/contacts')).rejects.toThrow(/No access token returned/);
  });
});

// ─── Retry on 5xx ────────────────────────────────────────────────────────────

describe('Retry on server errors (5xx)', () => {
  it('should retry on 500 and succeed', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(createMockResponse(500, { error: 'internal' }))
      .mockResolvedValueOnce(createMockResponse(200, { value: 'ok' }));
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions());
    const result = await client.get<{ value: string }>('/contacts');

    expect(result.value).toBe('ok');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });

  it('should throw after maxRetries exhausted on 5xx', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockResponse(500, { error: 'down' }));
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions({ maxRetries: 2 }));

    await expect(client.get('/contacts')).rejects.toThrow(ApiRequestError);
    // 1 initial + 2 retries = 3 calls
    expect(mockFetch).toHaveBeenCalledTimes(3);

    vi.unstubAllGlobals();
  });
});

// ─── 401 Token Refresh ───────────────────────────────────────────────────────

describe('401 token refresh', () => {
  it('should clear token cache and retry once on 401', async () => {
    const credential = createMockCredential();
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(createMockResponse(401, { error: 'unauthorized' }))
      .mockResolvedValueOnce(createMockResponse(200, { value: 'ok' }));
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions({ credential }));
    const result = await client.get<{ value: string }>('/contacts');

    expect(result.value).toBe('ok');
    // First call uses cached token, 401 clears cache, second call re-acquires
    expect(credential.getToken).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });

  it('should throw on double 401', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockResponse(401, { error: 'unauthorized' }));
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions());

    await expect(client.get('/contacts')).rejects.toThrow(ApiRequestError);
    const error = await client.get('/contacts').catch((e: ApiRequestError) => e);
    expect(error.code).toBe(ErrorCode.API_UNAUTHORIZED);
    // typegen rephrases the browser-leaning core 401 text for the Node/token context
    expect(error.message).toContain('access token');

    vi.unstubAllGlobals();
  });
});

// ─── 404 Not Found ───────────────────────────────────────────────────────────

describe('404 handling', () => {
  it('should throw API_NOT_FOUND on 404', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockResponse(404, { error: 'not found' }));
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions());

    const error = await client.get('/nonexistent').catch((e: ApiRequestError) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.code).toBe(ErrorCode.API_NOT_FOUND);
    expect(error.statusCode).toBe(404);

    // 404 should NOT be retried
    expect(mockFetch).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });
});

// ─── 429 Rate Limiting ───────────────────────────────────────────────────────

describe('429 rate limiting', () => {
  it('should retry on 429 and succeed', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(createMockResponse(429, {}, { 'Retry-After': '1' }))
      .mockResolvedValueOnce(createMockResponse(200, { value: 'ok' }));
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions());
    const result = await client.get<{ value: string }>('/contacts');

    expect(result.value).toBe('ok');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });

  it('should throw after maxRateLimitRetries exhausted', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockResponse(429, {}, { 'Retry-After': '1' }));
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions({ maxRateLimitRetries: 2 }));

    const error = await client.get('/contacts').catch((e: ApiRequestError) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.code).toBe(ErrorCode.API_RATE_LIMITED);

    // 1 initial + 2 rate limit retries = 3 calls
    expect(mockFetch).toHaveBeenCalledTimes(3);

    vi.unstubAllGlobals();
  });
});

// ─── Network Errors ──────────────────────────────────────────────────────────

describe('Network error handling', () => {
  it('should retry on network error and succeed', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(createMockResponse(200, { value: 'ok' }));
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions());
    const result = await client.get<{ value: string }>('/contacts');

    expect(result.value).toBe('ok');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });

  it('should throw after maxRetries on persistent network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions({ maxRetries: 1 }));

    await expect(client.get('/contacts')).rejects.toThrow(ApiRequestError);
    // 1 initial + 1 retry = 2 calls
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });
});

// ─── OData Paging (getAll) ───────────────────────────────────────────────────

describe('DataverseHttpClient.getAll', () => {
  it('should follow @odata.nextLink across pages', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(createMockResponse(200, {
        value: [{ id: '1' }, { id: '2' }],
        '@odata.nextLink': 'https://testorg.crm4.dynamics.com/api/data/v9.2/contacts?$skiptoken=2',
      }))
      .mockResolvedValueOnce(createMockResponse(200, {
        value: [{ id: '3' }],
        // No nextLink = last page
      }));
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions());
    const results = await client.getAll<{ id: string }>('/contacts');

    expect(results).toHaveLength(3);
    expect(results.map((r) => r.id)).toEqual(['1', '2', '3']);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });

  it('should stop at maxPages safety limit', async () => {
    // Always return a nextLink (infinite paging)
    const mockFetch = vi.fn().mockImplementation((_url: string) =>
      Promise.resolve(createMockResponse(200, {
        value: [{ id: 'x' }],
        '@odata.nextLink': 'https://testorg.crm4.dynamics.com/api/data/v9.2/contacts?$skiptoken=next',
      })),
    );
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions({ maxPages: 3 }));
    const results = await client.getAll<{ id: string }>('/contacts');

    // 3 pages, 1 record each
    expect(results).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    vi.unstubAllGlobals();
  });

  it('should return empty array when value is empty', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockResponse(200, { value: [] }));
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions());
    const results = await client.getAll<{ id: string }>('/contacts?$filter=name eq "nobody"');

    expect(results).toEqual([]);
    expect(mockFetch).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });
});

// ─── Concurrency Control ─────────────────────────────────────────────────────

describe('Concurrency control', () => {
  it('should limit concurrent requests to maxConcurrency', async () => {
    let activeCalls = 0;
    let peakCalls = 0;

    const mockFetch = vi.fn().mockImplementation(() => {
      activeCalls++;
      peakCalls = Math.max(peakCalls, activeCalls);
      return new Promise<Response>((resolve) => {
        setTimeout(() => {
          activeCalls--;
          resolve(createMockResponse(200, { value: 'ok' }));
        }, 10);
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions({ maxConcurrency: 2 }));

    // Fire 5 concurrent requests
    await Promise.all([
      client.get('/a'),
      client.get('/b'),
      client.get('/c'),
      client.get('/d'),
      client.get('/e'),
    ]);

    // Peak should never exceed maxConcurrency
    expect(peakCalls).toBeLessThanOrEqual(2);
    expect(mockFetch).toHaveBeenCalledTimes(5);

    vi.unstubAllGlobals();
  });
});

// ─── Read-Only Safety ────────────────────────────────────────────────────────

describe('read-only safety', () => {
  it('should be read-only by default', () => {
    const client = new DataverseHttpClient(createTestOptions());
    expect(client.isReadOnly).toBe(true);
  });

  it('should block write operations when readOnly is true (default)', () => {
    const client = new DataverseHttpClient(createTestOptions());

    expect(() => client.assertWriteAllowed('POST /accounts')).toThrowError(/BLOCKED/);
    expect(() => client.assertWriteAllowed('PATCH /accounts(id)')).toThrowError(/BLOCKED/);
    expect(() => client.assertWriteAllowed('DELETE /accounts(id)')).toThrowError(/BLOCKED/);
  });

  it('should block write operations when readOnly is explicitly true', () => {
    const client = new DataverseHttpClient(createTestOptions({ readOnly: true }));

    expect(() => client.assertWriteAllowed('PUT')).toThrowError(/read-only mode/);
  });

  it('should allow write operations when readOnly is explicitly false', () => {
    const client = new DataverseHttpClient(createTestOptions({ readOnly: false }));

    expect(client.isReadOnly).toBe(false);
    expect(() => client.assertWriteAllowed('POST /accounts')).not.toThrow();
    expect(() => client.assertWriteAllowed('PATCH /accounts(id)')).not.toThrow();
  });

  it('should always allow GET requests regardless of readOnly flag', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockResponse(200, { value: 'test' }));
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions({ readOnly: true }));
    await client.get('/EntityDefinitions');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Verify the request used GET method explicitly
    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[1].method).toBe('GET');

    vi.unstubAllGlobals();
  });

  it('should include explicit method: GET in fetch calls', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockResponse(200, { value: [] }));
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions());
    await client.getAll('/EntityDefinitions');

    // Every fetch call must have method: 'GET' explicitly set
    for (const call of mockFetch.mock.calls) {
      expect(call[1].method).toBe('GET');
    }

    vi.unstubAllGlobals();
  });

  it('should not include Content-Type header in GET requests (no body)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(createMockResponse(200, { value: 'test' }));
    vi.stubGlobal('fetch', mockFetch);

    const client = new DataverseHttpClient(createTestOptions());
    await client.get('/EntityDefinitions');

    const fetchCall = mockFetch.mock.calls[0];
    const headers = fetchCall[1].headers;
    // GET requests should NOT have Content-Type (no body)
    expect(headers['Content-Type']).toBeUndefined();

    vi.unstubAllGlobals();
  });
});
