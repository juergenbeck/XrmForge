import { describe, it, expect, vi } from 'vitest';
import { BrowserTransport } from '../src/browser-transport.js';

describe('BrowserTransport.resolveUrl', () => {
  it('builds an absolute API URL from a relative path', () => {
    const transport = new BrowserTransport({ clientUrl: 'https://org.crm4.dynamics.com' });
    expect(transport.resolveUrl('accounts?$select=name')).toBe(
      'https://org.crm4.dynamics.com/api/data/v9.2/accounts?$select=name',
    );
  });

  it('passes an absolute URL (an @odata.nextLink) through unchanged', () => {
    const transport = new BrowserTransport({ clientUrl: 'https://org.crm4.dynamics.com' });
    const absolute = 'https://org.crm4.dynamics.com/api/data/v9.2/accounts?$skiptoken=x';
    expect(transport.resolveUrl(absolute)).toBe(absolute);
  });

  it('trims a trailing slash on the client URL', () => {
    const transport = new BrowserTransport({ clientUrl: 'https://org.crm4.dynamics.com/' });
    expect(transport.resolveUrl('accounts')).toBe(
      'https://org.crm4.dynamics.com/api/data/v9.2/accounts',
    );
  });

  it('honors a custom apiVersion', () => {
    const transport = new BrowserTransport({
      clientUrl: 'https://org.crm4.dynamics.com',
      apiVersion: 'v9.1',
    });
    expect(transport.resolveUrl('accounts')).toBe(
      'https://org.crm4.dynamics.com/api/data/v9.1/accounts',
    );
  });
});

describe('BrowserTransport.send', () => {
  it('performs a cookie-based request with OData headers and no Authorization', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(
        new Response('{"value":[]}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const transport = new BrowserTransport({ clientUrl: 'https://org.crm4.dynamics.com' });
      const response = await transport.send({ method: 'GET', url: transport.resolveUrl('accounts') });

      expect(response.status).toBe(200);
      expect(response.ok).toBe(true);
      expect(await response.text()).toBe('{"value":[]}');

      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe('https://org.crm4.dynamics.com/api/data/v9.2/accounts');
      expect(calls[0]?.init.credentials).toBe('include');
      const headers = calls[0]?.init.headers as Record<string, string>;
      expect(headers['Accept']).toBe('application/json');
      expect(headers['OData-MaxVersion']).toBe('4.0');
      expect(headers['OData-Version']).toBe('4.0');
      expect(headers['Authorization']).toBeUndefined();
      // A GET carries no body, so no Content-Type is set.
      expect(headers['Content-Type']).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('sets Content-Type when a request body is present', async () => {
    const calls: Array<{ init: RequestInit }> = [];
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      calls.push({ init });
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const transport = new BrowserTransport({ clientUrl: 'https://org.crm4.dynamics.com' });
      await transport.send({
        method: 'POST',
        url: transport.resolveUrl('accounts'),
        body: '{"name":"x"}',
      });
      const headers = calls[0]?.init.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('exposes response headers via getHeader (case-insensitive, null when absent)', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response('{}', { status: 200, headers: { 'Retry-After': '5' } })),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      const transport = new BrowserTransport({ clientUrl: 'https://org.crm4.dynamics.com' });
      const response = await transport.send({ method: 'GET', url: transport.resolveUrl('accounts') });
      expect(response.getHeader('retry-after')).toBe('5');
      expect(response.getHeader('X-Absent')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
