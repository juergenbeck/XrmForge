/**
 * @xrmforge/testing - FakeTransport
 *
 * A scriptable {@link DataverseTransport} for testing code that uses
 * `@xrmforge/dataverse-client` (e.g. `retrieveAll`) without a real fetch or a
 * global fetch mock. Inject it via the client's `transport` option:
 *
 * ```typescript
 * const transport = new FakeTransport([
 *   { body: { value: [{ accountid: '1' }], '@odata.nextLink': 'https://org/api/data/v9.2/accounts?$skiptoken=p2' } },
 *   { body: { value: [{ accountid: '2' }] } }, // last page: no nextLink
 * ]);
 * const rows = await retrieveAll('accounts', undefined, { transport });
 * expect(transport.requests).toHaveLength(2);
 * ```
 *
 * The type-only import keeps `@xrmforge/dataverse-core` an optional peer: only
 * consumers that use FakeTransport need it installed.
 */

import type {
  DataverseHttpResponse,
  DataverseRequest,
  DataverseTransport,
} from '@xrmforge/dataverse-core';

/** One scripted reply from a {@link FakeTransport}. */
export interface FakeReply {
  /** HTTP status. Default 200. */
  status?: number;
  /** Response body. An object/array is JSON-serialized; a string is sent as-is. */
  body?: unknown;
  /** Response headers, e.g. `{ 'Retry-After': '2' }`. */
  headers?: Record<string, string>;
  /** When set, `send` rejects with this error instead of replying (network failure). */
  error?: Error;
}

/** Options for {@link FakeTransport}. */
export interface FakeTransportOptions {
  /** Base URL used by {@link FakeTransport.resolveUrl} for relative paths. */
  baseUrl?: string;
}

/**
 * A {@link DataverseTransport} that replays a fixed queue of scripted replies and
 * records every request it receives. Once the queue is exhausted it repeats the
 * last reply, so a single reply can drive a single-page test while a multi-page
 * test lists one reply per page (the last one without an `@odata.nextLink`).
 */
export class FakeTransport implements DataverseTransport {
  /** Every request passed to {@link send}, in order. */
  public readonly requests: DataverseRequest[] = [];
  private readonly replies: FakeReply[];
  private readonly baseUrl: string;
  private index = 0;

  constructor(replies: FakeReply | FakeReply[] = {}, options: FakeTransportOptions = {}) {
    this.replies = Array.isArray(replies) ? [...replies] : [replies];
    if (this.replies.length === 0) this.replies.push({});
    this.baseUrl = (options.baseUrl ?? 'https://fake.crm.dynamics.com/api/data/v9.2').replace(
      /\/$/,
      '',
    );
  }

  resolveUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    const relative = path.startsWith('/') ? path.slice(1) : path;
    return `${this.baseUrl}/${relative}`;
  }

  send(request: DataverseRequest): Promise<DataverseHttpResponse> {
    this.requests.push(request);
    // Take the reply at the current position, then advance; repeat the last one
    // once the queue is exhausted.
    const reply = this.replies[Math.min(this.index, this.replies.length - 1)] ?? {};
    this.index++;

    if (reply.error) return Promise.reject(reply.error);

    const status = reply.status ?? 200;
    const bodyText =
      typeof reply.body === 'string'
        ? reply.body
        : reply.body === undefined
          ? ''
          : JSON.stringify(reply.body);
    const headers = reply.headers ?? {};

    const response: DataverseHttpResponse = {
      status,
      ok: status >= 200 && status < 300,
      // Case-insensitive lookup, matching a real Response.headers.get().
      getHeader: (name) => {
        const lower = name.toLowerCase();
        for (const [key, value] of Object.entries(headers)) {
          if (key.toLowerCase() === lower) return value;
        }
        return null;
      },
      text: () => Promise.resolve(bodyText),
    };
    return Promise.resolve(response);
  }
}
