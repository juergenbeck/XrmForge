import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChangeDetector } from '../src/metadata/change-detector.js';
import { DataverseHttpClient } from '../src/http/client.js';
import { MetadataError, ErrorCode } from '../src/errors.js';
import { configureLogging, SilentLogSink, ConsoleLogSink, LogLevel } from '../src/logger.js';
import type { TokenCredential, AccessToken, GetTokenOptions } from '@azure/identity';

beforeEach(() => configureLogging({ sink: new SilentLogSink() }));
afterEach(() => {
  configureLogging({ sink: new ConsoleLogSink(), minLevel: LogLevel.INFO });
  vi.unstubAllGlobals();
});

function createMockCredential(): TokenCredential {
  return {
    getToken: vi.fn<[string | string[], GetTokenOptions?], Promise<AccessToken>>().mockResolvedValue({
      token: 'mock-token',
      expiresOnTimestamp: Date.now() + 60 * 60 * 1000,
    }),
  };
}

function createClient(): DataverseHttpClient {
  return new DataverseHttpClient({
    environmentUrl: 'https://testorg.crm4.dynamics.com',
    credential: createMockCredential(),
    maxRetries: 0,
    retryBaseDelayMs: 1,
    timeoutMs: 5000,
    maxConcurrency: 5,
  });
}

function mockFetch(response: { status: number; body: unknown }): void {
  const mockFn = vi.fn().mockResolvedValue({
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    statusText: response.status === 200 ? 'OK' : 'Error',
    headers: new Headers(),
    json: () => Promise.resolve(response.body),
    text: () => Promise.resolve(JSON.stringify(response.body)),
  });
  vi.stubGlobal('fetch', mockFn);
}

// ─── detectChanges ──────────────────────────────────────────────────────────

describe('ChangeDetector.detectChanges', () => {
  it('should return changed entity names', async () => {
    mockFetch({
      status: 200,
      body: {
        EntityMetadata: [
          { LogicalName: 'account', HasChanged: true, MetadataId: 'a1' },
          { LogicalName: 'contact', HasChanged: true, MetadataId: 'a2' },
          { LogicalName: 'lead', HasChanged: false, MetadataId: 'a3' },
        ],
        ServerVersionStamp: 'new-stamp-123',
      },
    });

    const detector = new ChangeDetector(createClient());
    const result = await detector.detectChanges('old-stamp-456');

    expect(result.changedEntityNames).toEqual(['account', 'contact']);
    expect(result.newVersionStamp).toBe('new-stamp-123');
  });

  it('should return empty array when nothing changed', async () => {
    mockFetch({
      status: 200,
      body: {
        EntityMetadata: [
          { LogicalName: 'account', HasChanged: false, MetadataId: 'a1' },
        ],
        ServerVersionStamp: 'same-stamp',
      },
    });

    const detector = new ChangeDetector(createClient());
    const result = await detector.detectChanges('old-stamp');

    expect(result.changedEntityNames).toHaveLength(0);
    expect(result.newVersionStamp).toBe('same-stamp');
  });

  it('should treat HasChanged=null as changed', async () => {
    mockFetch({
      status: 200,
      body: {
        EntityMetadata: [
          { LogicalName: 'account', HasChanged: null, MetadataId: 'a1' },
        ],
        ServerVersionStamp: 'stamp',
      },
    });

    const detector = new ChangeDetector(createClient());
    const result = await detector.detectChanges('old');

    expect(result.changedEntityNames).toEqual(['account']);
  });

  it('should handle empty EntityMetadata array', async () => {
    mockFetch({
      status: 200,
      body: {
        EntityMetadata: [],
        ServerVersionStamp: 'stamp',
      },
    });

    const detector = new ChangeDetector(createClient());
    const result = await detector.detectChanges('old');

    expect(result.changedEntityNames).toHaveLength(0);
  });

  it('should throw META_VERSION_STAMP_EXPIRED on expired stamp', async () => {
    // The HTTP client wraps 400 errors into ApiRequestError with the body text in the message
    mockFetch({
      status: 400,
      body: { error: { code: '0x80044352', message: 'VersionStamp expired: 0x80044352 ExpiredVersionStamp' } },
    });

    const detector = new ChangeDetector(createClient());

    const error = await detector.detectChanges('expired-stamp').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MetadataError);
    expect((error as MetadataError).code).toBe(ErrorCode.META_VERSION_STAMP_EXPIRED);
  });

  it('should send correct request body format', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({ EntityMetadata: [], ServerVersionStamp: 's' }),
      text: () => Promise.resolve('{}'),
    });
    vi.stubGlobal('fetch', mockFn);

    const detector = new ChangeDetector(createClient());
    await detector.detectChanges('my-stamp');

    expect(mockFn).toHaveBeenCalledTimes(1);
    const [url, options] = mockFn.mock.calls[0]!;
    expect(url).toContain('/RetrieveMetadataChanges');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.ClientVersionStamp).toBe('my-stamp');
    expect(body.DeletedMetadataFilters).toBe('Entity');
  });
});

// ─── getInitialVersionStamp ─────────────────────────────────────────────────

describe('ChangeDetector.getInitialVersionStamp', () => {
  it('should return the server version stamp', async () => {
    mockFetch({
      status: 200,
      body: { ServerVersionStamp: 'initial-stamp-789' },
    });

    const detector = new ChangeDetector(createClient());
    const stamp = await detector.getInitialVersionStamp();

    expect(stamp).toBe('initial-stamp-789');
  });

  it('should send request without ClientVersionStamp', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({ ServerVersionStamp: 's' }),
      text: () => Promise.resolve('{}'),
    });
    vi.stubGlobal('fetch', mockFn);

    const detector = new ChangeDetector(createClient());
    await detector.getInitialVersionStamp();

    const body = JSON.parse(mockFn.mock.calls[0]![1].body);
    expect(body.ClientVersionStamp).toBeUndefined();
  });
});
