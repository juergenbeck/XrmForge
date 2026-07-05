import { describe, it, expect } from 'vitest';
import { retrieveAll } from '../src/retrieve.js';
import type {
  DataverseHttpResponse,
  DataverseRequest,
  DataverseTransport,
} from '@xrmforge/dataverse-core';

function makeResponse(status: number, body: string): DataverseHttpResponse {
  return {
    status,
    ok: status >= 200 && status < 300,
    getHeader: () => null,
    text: () => Promise.resolve(body),
  };
}

/** A transport that serves a fixed queue of OData pages in order. */
class PageQueueTransport implements DataverseTransport {
  public readonly requests: DataverseRequest[] = [];
  private readonly pages: Array<{ value: unknown[]; nextLink?: string }>;

  constructor(pages: Array<{ value: unknown[]; nextLink?: string }>) {
    this.pages = [...pages];
  }

  resolveUrl(path: string): string {
    return path.startsWith('http')
      ? path
      : `https://org.crm4.dynamics.com/api/data/v9.2/${path}`;
  }

  send(request: DataverseRequest): Promise<DataverseHttpResponse> {
    this.requests.push(request);
    const page = this.pages.shift();
    if (!page) {
      return Promise.resolve(makeResponse(404, '{"error":{"message":"no more pages"}}'));
    }
    const body: Record<string, unknown> = { value: page.value };
    if (page.nextLink) body['@odata.nextLink'] = page.nextLink;
    return Promise.resolve(makeResponse(200, JSON.stringify(body)));
  }
}

const NEXT = 'https://org.crm4.dynamics.com/api/data/v9.2/accounts';

describe('retrieveAll - paging', () => {
  it('returns the records of a single page', async () => {
    const transport = new PageQueueTransport([{ value: [{ id: 1 }, { id: 2 }] }]);
    const result = await retrieveAll('accounts', undefined, { transport });
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(transport.requests).toHaveLength(1);
  });

  it('follows @odata.nextLink across pages and concatenates records', async () => {
    const transport = new PageQueueTransport([
      { value: [{ id: 1 }], nextLink: `${NEXT}?$skiptoken=p2` },
      { value: [{ id: 2 }], nextLink: `${NEXT}?$skiptoken=p3` },
      { value: [{ id: 3 }] },
    ]);
    const result = await retrieveAll<{ id: number }>('accounts', '$select=name', { transport });
    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(transport.requests).toHaveLength(3);
    expect(transport.requests[1]?.url).toContain('$skiptoken=p2');
    expect(transport.requests[2]?.url).toContain('$skiptoken=p3');
  });

  it('returns an empty array for an empty entity set', async () => {
    const transport = new PageQueueTransport([{ value: [] }]);
    const result = await retrieveAll('accounts', undefined, { transport });
    expect(result).toEqual([]);
  });
});

describe('retrieveAll - URL construction', () => {
  it('builds the first URL from the entity set and query', async () => {
    const transport = new PageQueueTransport([{ value: [] }]);
    await retrieveAll('accounts', '$select=name&$top=10', { transport });
    expect(transport.requests[0]?.url).toBe(
      'https://org.crm4.dynamics.com/api/data/v9.2/accounts?$select=name&$top=10',
    );
  });

  it('strips a leading "?" from the query', async () => {
    const transport = new PageQueueTransport([{ value: [] }]);
    await retrieveAll('accounts', '?$select=name', { transport });
    expect(transport.requests[0]?.url).toBe(
      'https://org.crm4.dynamics.com/api/data/v9.2/accounts?$select=name',
    );
  });

  it('omits the query segment when none is given', async () => {
    const transport = new PageQueueTransport([{ value: [] }]);
    await retrieveAll('accounts', undefined, { transport });
    expect(transport.requests[0]?.url).toBe('https://org.crm4.dynamics.com/api/data/v9.2/accounts');
  });
});

describe('retrieveAll - safety cap', () => {
  it('stops at the maxPages cap and reports it via onMaxPagesReached', async () => {
    const transport = new PageQueueTransport([
      { value: [{ id: 1 }], nextLink: `${NEXT}?$skiptoken=p2` },
      { value: [{ id: 2 }], nextLink: `${NEXT}?$skiptoken=p3` },
      { value: [{ id: 3 }], nextLink: `${NEXT}?$skiptoken=p4` },
    ]);
    const capEvents: Array<{ pages: number; records: number }> = [];
    const result = await retrieveAll('accounts', undefined, {
      transport,
      maxPages: 2,
      onMaxPagesReached: (info) => capEvents.push(info),
    });
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(transport.requests).toHaveLength(2);
    expect(capEvents).toEqual([{ pages: 2, records: 2 }]);
  });

  it('does not invoke onMaxPagesReached when all pages fit under the cap', async () => {
    const transport = new PageQueueTransport([{ value: [{ id: 1 }] }]);
    let called = false;
    await retrieveAll('accounts', undefined, {
      transport,
      maxPages: 5,
      onMaxPagesReached: () => {
        called = true;
      },
    });
    expect(called).toBe(false);
  });
});

describe('retrieveAll - validation and cancellation', () => {
  it('rejects an invalid entity set name before issuing any request', async () => {
    const transport = new PageQueueTransport([{ value: [] }]);
    await expect(retrieveAll("accounts');drop", undefined, { transport })).rejects.toMatchObject({
      code: 'INVALID_IDENTIFIER',
    });
    expect(transport.requests).toHaveLength(0);
  });

  it('propagates an abort via the signal', async () => {
    const transport = new PageQueueTransport([{ value: [{ id: 1 }] }]);
    const controller = new AbortController();
    controller.abort();
    await expect(
      retrieveAll('accounts', undefined, { transport, signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('surfaces an HTTP error raised while fetching a page', async () => {
    // Empty queue -> the transport answers 404 on the first request.
    const transport = new PageQueueTransport([]);
    await expect(retrieveAll('accounts', undefined, { transport })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });
});
