# @xrmforge/webapi

[![npm version](https://img.shields.io/npm/v/@xrmforge/webapi.svg)](https://www.npmjs.com/package/@xrmforge/webapi)
[![license](https://img.shields.io/npm/l/@xrmforge/webapi.svg)](https://github.com/juergenbeck/XrmForge/blob/main/LICENSE)

**A type-safe wrapper around `Xrm.WebApi` with a fluent query builder.** Returns your generated entity interfaces instead of `any`, raises structured `WebApiError`s, and builds OData query strings from generated `Fields` enums -- no raw strings, no `unknown` casts.

> Part of [XrmForge](https://github.com/juergenbeck/XrmForge#readme). Browser-safe; import it in D365 form scripts.

---

## Installation

```bash
npm install @xrmforge/webapi
```

**Requirements:** `@types/xrm` (>= 9.0.0) as a peer dependency, and a running D365 client context (`Xrm.WebApi` must be available).

---

## CRUD with typed results

Pass a generated entity interface as the type parameter and get a fully typed result back:

```typescript
import { webApi, query } from '@xrmforge/webapi';
import type { Account } from '../../generated/entities/account.js';
import { AccountFields } from '../../generated/fields/account.js';

// retrieve<T>(entityName, id, queryOrString?)
const account = await webApi.retrieve<Account>('account', id,
  query.select(AccountFields.Name, AccountFields.City));
account.name;          // string | null (typed, not unknown)

// create -> returns the new record's GUID
const newId = await webApi.create('account', { name: 'Contoso Ltd' });

// update / remove
await webApi.update('account', id, { name: 'Contoso GmbH' });
await webApi.remove('account', id);
```

The same functions are also exported individually (`retrieve`, `retrieveMultiple`, `create`, `update`, `remove`) if you prefer named imports over the `webApi` namespace object.

### Retrieving multiple records (with pagination)

`retrieveMultiple` returns only the **first page** by default (up to 5000 records), which is backwards-compatible and avoids accidental full-table scans. Opt into more pages with `maxPages`:

```typescript
import { retrieveMultiple } from '@xrmforge/webapi';

const firstPage = await retrieveMultiple<Account>('account', query.top(50));

const all = await retrieveMultiple<Account>('account',
  query.filter(`${AccountFields.City} eq 'Berlin'`),
  { maxPages: Infinity });   // follow every nextLink
```

---

## Query builder

A fluent, chainable builder for OData query strings. Every method returns the builder, and `.build()` produces the `?$...` string (it is also accepted directly by the CRUD functions).

```typescript
import { query } from '@xrmforge/webapi';
import { AccountFields } from '../../generated/fields/account.js';

const q = query
  .select(AccountFields.Name, AccountFields.City)
  .filter(`${AccountFields.City} ne null`)
  .orderBy(AccountFields.Name)          // default direction: asc
  .top(50)
  .expand('primarycontactid', ['fullname', 'emailaddress1']);

q.build();
// "?$select=name,address1_city&$filter=address1_city ne null&$orderby=name asc&$top=50&$expand=primarycontactid($select=fullname,emailaddress1)"
```

| Builder method | OData clause |
|----------------|--------------|
| `select(...fields)` | `$select` |
| `filter(expr)` | `$filter` (multiple calls combined with `and`) |
| `orderBy(field, 'asc' \| 'desc')` | `$orderby` |
| `top(n)` | `$top` |
| `expand(nav, subSelect?)` | `$expand` |
| `build()` / `toString()` | the final query string |

Start a query with `query.select(...)`, `query.filter(...)`, `query.top(...)`, or `query.expand(...)`; create an empty one with `createQuery()`; or instantiate `new QueryBuilder()` directly.

---

## Error handling

All operations throw a `WebApiError` on failure, and on invalid arguments such as a missing `entityName` or `id`. It carries `message`, `statusCode` (HTTP status), `errorCode` (the Dataverse error code), and an optional `innerMessage`:

```typescript
import { WebApiError } from '@xrmforge/webapi';

try {
  await webApi.retrieve<Account>('account', id);
} catch (err) {
  if (err instanceof WebApiError) {
    console.error(err.statusCode, err.errorCode, err.message);
  }
}
```

---

## Exports

`webApi`, `retrieve`, `retrieveMultiple`, `create`, `update`, `remove`, `QueryBuilder`, `createQuery`, `query`, `WebApiError`, and the type `RetrieveMultipleOptions`.

## Documentation

Full guide: [XrmForge on GitHub](https://github.com/juergenbeck/XrmForge#readme).

## License

[MIT](https://github.com/juergenbeck/XrmForge/blob/main/LICENSE) (c) XrmForge Contributors.
