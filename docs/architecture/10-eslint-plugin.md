# ESLint Plugin

### 10.1 Installation

```javascript
// eslint.config.js (flat config, ESLint v9)
import xrmforge from '@xrmforge/eslint-plugin';

export default [
  xrmforge.configs.recommended,
  // or pick individual rules
];
```

### 10.2 Rules

#### no-xrm-page (error)

Forbids the deprecated `Xrm.Page` API (removed in D365 v9.0+).

```typescript
// Bad
Xrm.Page.getAttribute("name");

// Good
const form = executionContext.getFormContext();
form.getAttribute("name");
```

#### no-magic-optionset (warn)

Forbids raw numbers (>= 2) in comparisons with `.getValue()`.

```typescript
// Bad
if (attr.getValue() === 595300000) { }

// Good
import { StatusCode } from '../generated/optionsets/account';
if (attr.getValue() === StatusCode.Active) { }
```

#### no-sync-webapi (error)

Forbids synchronous XMLHttpRequest (`new XMLHttpRequest()` and `.open()` with `async=false`).

```typescript
// Bad
xhr.open("GET", url, false);

// Good
const data = await Xrm.WebApi.retrieveRecord("account", id);
```

#### require-error-handling (warn)

Requires try/catch in exported async functions starting with "on" (event handlers).

```typescript
// Bad
export async function onLoad(ctx) {
  await fetch("/api");  // no error handling
}

// Good
export async function onLoad(ctx) {
  try { await fetch("/api"); }
  catch (error) { console.error(error); }
}
```

#### require-namespace (warn)

Forbids direct `window.X = ...` or `globalThis.X = ...` assignments. Module exports with esbuild globalName should be used instead.

```typescript
// Bad
window.Contoso = { onLoad: function() {} };

// Good
export function onLoad(ctx: Xrm.Events.EventContext) {}
```
