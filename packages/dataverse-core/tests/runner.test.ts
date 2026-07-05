import { describe, it, expect } from 'vitest';
import { ResilientRunner } from '../src/runner.js';
import type {
  DataverseHttpResponse,
  DataverseRequest,
  DataverseTransport,
} from '../src/transport.js';

/** Build a minimal fake response. */
function fakeResponse(init: {
  status: number;
  body?: string;
  headers?: Record<string, string>;
}): DataverseHttpResponse {
  const headers = init.headers ?? {};
  return {
    status: init.status,
    ok: init.status >= 200 && init.status < 300,
    getHeader: (name) => headers[name] ?? headers[name.toLowerCase()] ?? null,
    text: () => Promise.resolve(init.body ?? ''),
  };
}

/** A transport that replays a scripted sequence of responses / thrown errors. */
class ScriptedTransport implements DataverseTransport {
  public readonly sent: DataverseRequest[] = [];
  private readonly steps: Array<DataverseHttpResponse | Error>;

  constructor(steps: Array<DataverseHttpResponse | Error>) {
    this.steps = [...steps];
  }

  resolveUrl(path: string): string {
    return path.startsWith('http') ? path : `https://org.crm4.dynamics.com/api/data/v9.2/${path}`;
  }

  send(request: DataverseRequest): Promise<DataverseHttpResponse> {
    this.sent.push(request);
    const step = this.steps.shift();
    if (step === undefined) return Promise.reject(new Error('ScriptedTransport: no steps left'));
    if (step instanceof Error) return Promise.reject(step);
    return Promise.resolve(step);
  }
}

/** Zero-delay backoff so retry paths run instantly in tests. */
const FAST = { retryBaseDelayMs: 0, maxBackoffMs: 0 } as const;

describe('ResilientRunner - success', () => {
  it('returns the parsed JSON body', async () => {
    const transport = new ScriptedTransport([
      fakeResponse({ status: 200, body: '{"value":[{"name":"Acme"}]}' }),
    ]);
    const runner = new ResilientRunner(transport, FAST);
    const result = await runner.send<{ value: Array<{ name: string }> }>({
      method: 'GET',
      url: 'https://org/api/data/v9.2/accounts',
    });
    expect(result.value[0]?.name).toBe('Acme');
    expect(transport.sent).toHaveLength(1);
  });

  it('returns undefined for an empty / HTTP 204 response', async () => {
    const transport = new ScriptedTransport([fakeResponse({ status: 204 })]);
    const runner = new ResilientRunner(transport, FAST);
    const result = await runner.send({ method: 'GET', url: 'https://org/a' });
    expect(result).toBeUndefined();
  });
});

describe('ResilientRunner - rate limiting (429)', () => {
  it('retries using Retry-After then succeeds', async () => {
    const transport = new ScriptedTransport([
      fakeResponse({ status: 429, headers: { 'Retry-After': '0' } }),
      fakeResponse({ status: 200, body: '{"ok":true}' }),
    ]);
    const runner = new ResilientRunner(transport, FAST);
    const result = await runner.send<{ ok: boolean }>({ method: 'GET', url: 'https://org/a' });
    expect(result.ok).toBe(true);
    expect(transport.sent).toHaveLength(2);
  });

  it('throws RATE_LIMITED after exhausting consecutive 429s', async () => {
    const steps = Array.from({ length: 5 }, () =>
      fakeResponse({ status: 429, headers: { 'Retry-After': '0' } }),
    );
    const transport = new ScriptedTransport(steps);
    const runner = new ResilientRunner(transport, { ...FAST, maxRateLimitRetries: 2 });
    await expect(runner.send({ method: 'GET', url: 'https://org/a' })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      statusCode: 429,
    });
    // initial + 2 retries, then the 3rd 429 exceeds the budget
    expect(transport.sent).toHaveLength(3);
  });
});

describe('ResilientRunner - server errors (5xx)', () => {
  it('retries on 500 then succeeds', async () => {
    const transport = new ScriptedTransport([
      fakeResponse({ status: 500, body: 'boom' }),
      fakeResponse({ status: 200, body: '{"ok":1}' }),
    ]);
    const runner = new ResilientRunner(transport, FAST);
    const result = await runner.send<{ ok: number }>({ method: 'GET', url: 'https://org/a' });
    expect(result.ok).toBe(1);
    expect(transport.sent).toHaveLength(2);
  });

  it('throws with the status code after 5xx retries are exhausted', async () => {
    const steps = Array.from({ length: 5 }, () => fakeResponse({ status: 503, body: 'down' }));
    const transport = new ScriptedTransport(steps);
    const runner = new ResilientRunner(transport, { ...FAST, maxRetries: 1 });
    await expect(runner.send({ method: 'GET', url: 'https://org/a' })).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(transport.sent).toHaveLength(2);
  });
});

describe('ResilientRunner - non-retryable HTTP errors', () => {
  it('throws UNAUTHORIZED on 401 without retrying', async () => {
    const transport = new ScriptedTransport([fakeResponse({ status: 401, body: 'no session' })]);
    const runner = new ResilientRunner(transport, FAST);
    await expect(runner.send({ method: 'GET', url: 'https://org/a' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
    expect(transport.sent).toHaveLength(1);
  });

  it('throws NOT_FOUND on 404', async () => {
    const transport = new ScriptedTransport([fakeResponse({ status: 404, body: 'missing' })]);
    const runner = new ResilientRunner(transport, FAST);
    await expect(runner.send({ method: 'GET', url: 'https://org/a' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('ResilientRunner - transport (network) errors', () => {
  it('retries a network error then throws REQUEST_FAILED', async () => {
    const transport = new ScriptedTransport([
      new TypeError('Failed to fetch'),
      new TypeError('Failed to fetch'),
    ]);
    const runner = new ResilientRunner(transport, { ...FAST, maxRetries: 1 });
    await expect(runner.send({ method: 'GET', url: 'https://org/a' })).rejects.toMatchObject({
      code: 'REQUEST_FAILED',
    });
    expect(transport.sent).toHaveLength(2);
  });
});

describe('ResilientRunner - cancellation', () => {
  it('throws ABORTED immediately when the caller signal is already aborted', async () => {
    const transport = new ScriptedTransport([fakeResponse({ status: 200, body: '{}' })]);
    const runner = new ResilientRunner(transport, FAST);
    const controller = new AbortController();
    controller.abort();
    await expect(
      runner.send({ method: 'GET', url: 'https://org/a', signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'ABORTED' });
    expect(transport.sent).toHaveLength(0);
  });

  it('propagates a caller abort that fires mid-flight', async () => {
    const abortAware: DataverseTransport = {
      resolveUrl: (path) => path,
      send: (request) =>
        new Promise<DataverseHttpResponse>((_resolve, reject) => {
          request.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    };
    const runner = new ResilientRunner(abortAware, FAST);
    const controller = new AbortController();
    const pending = runner.send({
      method: 'GET',
      url: 'https://org/a',
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('times out a hanging request and throws TIMEOUT', async () => {
    const hanging: DataverseTransport = {
      resolveUrl: (path) => path,
      send: (request) =>
        new Promise<DataverseHttpResponse>((_resolve, reject) => {
          request.signal?.addEventListener('abort', () => {
            const err = new Error('timed out');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    };
    const runner = new ResilientRunner(hanging, { ...FAST, timeoutMs: 5, maxRetries: 0 });
    await expect(runner.send({ method: 'GET', url: 'https://org/a' })).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });
});
