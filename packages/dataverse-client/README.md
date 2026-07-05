# @xrmforge/dataverse-client

Browser-first Dataverse Web API client for model-driven-app web resources and
form scripts. Cookie-based `fetch` (no bearer token) plus `retrieveAll` for
`@odata.nextLink` paging. Built on
[`@xrmforge/dataverse-core`](https://www.npmjs.com/package/@xrmforge/dataverse-core).
Zero runtime dependencies beyond core, `sideEffects: false`.

Why this exists: `Xrm.WebApi.retrieveMultipleRecords` cannot follow OData paging
across arbitrary result sizes ergonomically. `retrieveAll` wraps the
`@odata.nextLink` loop, resilience, and cancellation behind one call, verified
against a live Dataverse org (cookie auth via `credentials: "include"`).

## Install

```bash
npm install @xrmforge/dataverse-client
```

Requires `@types/xrm` as a peer dependency (for `Xrm.Utility.getGlobalContext`).

## Usage

```typescript
import { retrieveAll } from '@xrmforge/dataverse-client';
import type { Account } from './generated/entities/account';

// entitySetName is the PLURAL set name ("accounts"), used as the REST path
// segment - not the singular logical name that Xrm.WebApi uses.
const accounts = await retrieveAll<Account>('accounts', '$select=name,address1_city&$filter=statecode eq 0');
```

`retrieveAll` follows every `@odata.nextLink` up to a safety cap (`maxPages`,
default 100; each page holds up to 5000 records). Pass `onMaxPagesReached` to
observe a truncation, or raise `maxPages` for genuinely larger result sets:

```typescript
const rows = await retrieveAll<Account>('accounts', '$select=name', {
  maxPages: 500,
  signal: abortController.signal,
  onMaxPagesReached: ({ pages, records }) => console.warn(`Stopped at ${pages} pages / ${records} records`),
});
```

### Same-origin only

The cookie-based transport works for web resources served under the org URL
(same-origin to the Web API). A cross-origin (foreign-origin) web resource is
blocked by CORS - Dataverse sends no `Access-Control-Allow-Origin`.

## API

- `retrieveAll<T>(entitySetName, odataQuery?, options?)` - retrieve all pages.
- `BrowserTransport` - the cookie-based `DataverseTransport` (used by default).
- Re-exports from `@xrmforge/dataverse-core`: `DataverseError`, `DataverseHttpError`, `isDataverseError`, `sanitizeIdentifier`, `sanitizeGuid`, `escapeODataString`.

## Testing

Inject a fake transport to test code that calls `retrieveAll` without a real
fetch, using `FakeTransport` from
[`@xrmforge/testing`](https://www.npmjs.com/package/@xrmforge/testing):

```typescript
import { FakeTransport } from '@xrmforge/testing';

const transport = new FakeTransport([
  { body: { value: [{ accountid: '1' }], '@odata.nextLink': 'https://org/api/data/v9.2/accounts?$skiptoken=p2' } },
  { body: { value: [{ accountid: '2' }] } },
]);
const rows = await retrieveAll('accounts', undefined, { transport });
```

## License

MIT
