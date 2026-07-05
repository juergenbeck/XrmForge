import { describe, it, expect } from 'vitest';
import { FakeTransport } from '../src/fake-transport.js';

describe('FakeTransport.resolveUrl', () => {
  it('resolves relative paths against the base URL', () => {
    const transport = new FakeTransport({}, { baseUrl: 'https://org.crm4.dynamics.com/api/data/v9.2' });
    expect(transport.resolveUrl('accounts')).toBe(
      'https://org.crm4.dynamics.com/api/data/v9.2/accounts',
    );
  });

  it('passes absolute URLs through unchanged', () => {
    const transport = new FakeTransport();
    const abs = 'https://org.crm4.dynamics.com/api/data/v9.2/accounts?$skiptoken=x';
    expect(transport.resolveUrl(abs)).toBe(abs);
  });
});

describe('FakeTransport.send', () => {
  it('replies 200 with a JSON-serialized object body by default', async () => {
    const transport = new FakeTransport({ body: { value: [{ id: 1 }] } });
    const response = await transport.send({ method: 'GET', url: 'https://org/accounts' });
    expect(response.status).toBe(200);
    expect(response.ok).toBe(true);
    expect(JSON.parse(await response.text())).toEqual({ value: [{ id: 1 }] });
  });

  it('passes a string body through as-is', async () => {
    const transport = new FakeTransport({ body: 'raw text' });
    const response = await transport.send({ method: 'GET', url: 'https://org/x' });
    expect(await response.text()).toBe('raw text');
  });

  it('honors a custom status and marks non-2xx as not ok', async () => {
    const transport = new FakeTransport({ status: 404, body: { error: {} } });
    const response = await transport.send({ method: 'GET', url: 'https://org/x' });
    expect(response.status).toBe(404);
    expect(response.ok).toBe(false);
  });

  it('serves scripted replies in order', async () => {
    const transport = new FakeTransport([{ body: { page: 1 } }, { body: { page: 2 } }]);
    const first = await transport.send({ method: 'GET', url: 'https://org/x' });
    const second = await transport.send({ method: 'GET', url: 'https://org/x' });
    expect(JSON.parse(await first.text())).toEqual({ page: 1 });
    expect(JSON.parse(await second.text())).toEqual({ page: 2 });
  });

  it('repeats the last reply once the queue is exhausted', async () => {
    const transport = new FakeTransport([{ body: { page: 1 } }, { body: { page: 2 } }]);
    await transport.send({ method: 'GET', url: 'https://org/x' });
    await transport.send({ method: 'GET', url: 'https://org/x' });
    const third = await transport.send({ method: 'GET', url: 'https://org/x' });
    expect(JSON.parse(await third.text())).toEqual({ page: 2 });
  });

  it('exposes headers via getHeader (case-insensitive, null when absent)', async () => {
    const transport = new FakeTransport({ status: 429, headers: { 'Retry-After': '2' } });
    const response = await transport.send({ method: 'GET', url: 'https://org/x' });
    expect(response.getHeader('retry-after')).toBe('2');
    expect(response.getHeader('X-Absent')).toBeNull();
  });

  it('rejects with the scripted error (simulated network failure)', async () => {
    const boom = new TypeError('Failed to fetch');
    const transport = new FakeTransport({ error: boom });
    await expect(transport.send({ method: 'GET', url: 'https://org/x' })).rejects.toBe(boom);
  });

  it('records every request it receives, in order', async () => {
    const transport = new FakeTransport({ body: {} });
    await transport.send({ method: 'GET', url: 'https://org/a' });
    await transport.send({ method: 'POST', url: 'https://org/b', body: '{}' });
    expect(transport.requests).toHaveLength(2);
    expect(transport.requests[0]?.url).toBe('https://org/a');
    expect(transport.requests[1]?.method).toBe('POST');
  });
});
