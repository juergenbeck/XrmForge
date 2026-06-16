import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callCloudFlow } from '../src/cloud-flow.js';

interface MockResponseInit {
  ok?: boolean;
  status?: number;
  statusText?: string;
  contentType?: string | null;
  jsonBody?: unknown;
  textBody?: string;
}

function mockResponse(init: MockResponseInit = {}): Response {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    contentType = 'application/json',
    jsonBody,
    textBody,
  } = init;
  return {
    ok,
    status,
    statusText,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null) },
    json: async () => jsonBody,
    text: async () => textBody ?? (jsonBody !== undefined ? JSON.stringify(jsonBody) : ''),
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('callCloudFlow', () => {
  it('POSTs the body as JSON and returns the parsed JSON response', async () => {
    fetchMock.mockResolvedValue(mockResponse({ jsonBody: { total: 5, currency: 'EUR' } }));

    const result = await callCloudFlow<{ quoteId: string }, { total: number; currency: string }>(
      'https://flow.example/trigger?sig=abc',
      { quoteId: 'q1' },
    );

    expect(result).toEqual({ total: 5, currency: 'EUR' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://flow.example/trigger?sig=abc');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(opts.body).toBe(JSON.stringify({ quoteId: 'q1' }));
  });

  it('throws on a non-2xx status with the status and response body', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ ok: false, status: 500, statusText: 'Server Error', textBody: 'boom' }),
    );

    await expect(callCloudFlow('https://flow.example/trigger', { a: 1 })).rejects.toThrow(/500.*boom/);
  });

  it('sends no body and no Content-Type for a GET request', async () => {
    fetchMock.mockResolvedValue(mockResponse({ jsonBody: { ok: true } }));

    await callCloudFlow('https://flow.example/trigger', undefined, { method: 'GET' });

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.method).toBe('GET');
    expect(opts.body).toBeUndefined();
    expect(opts.headers['Content-Type']).toBeUndefined();
  });

  it('merges caller headers over the defaults', async () => {
    fetchMock.mockResolvedValue(mockResponse({ jsonBody: {} }));

    await callCloudFlow('https://flow.example/trigger', { a: 1 }, {
      headers: { 'Content-Type': 'text/plain', 'X-Correlation-Id': 'cid-1' },
    });

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('text/plain');
    expect(opts.headers['X-Correlation-Id']).toBe('cid-1');
  });

  it('returns undefined for a 204 No Content response', async () => {
    fetchMock.mockResolvedValue(mockResponse({ status: 204, contentType: null }));

    const result = await callCloudFlow('https://flow.example/trigger', { a: 1 });

    expect(result).toBeUndefined();
  });

  it('returns raw text for a non-JSON response', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ contentType: 'text/plain', textBody: 'accepted' }),
    );

    const result = await callCloudFlow<unknown, string>('https://flow.example/trigger', { a: 1 });

    expect(result).toBe('accepted');
  });

  it('forwards an AbortSignal', async () => {
    fetchMock.mockResolvedValue(mockResponse({ jsonBody: {} }));
    const controller = new AbortController();

    await callCloudFlow('https://flow.example/trigger', { a: 1 }, { signal: controller.signal });

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.signal).toBe(controller.signal);
  });
});
