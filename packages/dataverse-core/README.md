# @xrmforge/dataverse-core

Runtime-neutral core for the XrmForge Dataverse fetch layer. Zero runtime
dependencies, safe in both Node and browser bundles (`sideEffects: false`).

It provides the shared building blocks that the transport-specific clients build
on:

- **OData sanitizers** (`sanitizeIdentifier`, `sanitizeGuid`, `escapeODataString`) that guard against OData injection.
- **`DataverseTransport`** interface that separates authentication + URL building + a single fetch from resilience.
- **`ResilientRunner`** that wraps a transport with retry, exponential backoff + jitter, HTTP 429 awareness, and a per-attempt timeout, tuned lean for interactive UIs (no concurrency semaphore, smaller backoff caps).
- **Error types** (`DataverseError`, `DataverseHttpError`).

Most consumers use a higher-level package such as
[`@xrmforge/dataverse-client`](https://www.npmjs.com/package/@xrmforge/dataverse-client)
rather than this one directly. Reach for `dataverse-core` when you implement a
custom `DataverseTransport` (for example a Node/bearer-token adapter).

## Install

```bash
npm install @xrmforge/dataverse-core
```

## Usage

Implement a transport, then drive it with the runner:

```typescript
import { ResilientRunner, type DataverseTransport } from '@xrmforge/dataverse-core';

const transport: DataverseTransport = {
  resolveUrl: (path) =>
    path.startsWith('http') ? path : `https://org.crm4.dynamics.com/api/data/v9.2/${path}`,
  send: async (request) => {
    const response = await fetch(request.url, { method: request.method, signal: request.signal });
    return {
      status: response.status,
      ok: response.ok,
      getHeader: (name) => response.headers.get(name),
      text: () => response.text(),
    };
  },
};

const runner = new ResilientRunner(transport, { maxRetries: 2 });
const page = await runner.send<{ value: unknown[] }>({
  method: 'GET',
  url: transport.resolveUrl('accounts?$select=name&$top=10'),
});
```

## License

MIT
