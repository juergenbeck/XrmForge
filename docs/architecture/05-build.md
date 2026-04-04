# Build Architecture

### 5.1 esbuild IIFE Bundles

XrmForge uses esbuild to create IIFE (Immediately Invoked Function Expression) bundles for Dynamics 365. D365 requires scripts to be registered as namespace.function (e.g. `Contoso.Account.onLoad`).

**esbuild configuration per entry:**
```
format: 'iife'
bundle: true
globalName: entry.namespace    // e.g. 'Contoso.Account'
target: config.target          // default: 'es2020'
minify: config.minify
sourcemap: config.sourcemap
external: config.external      // e.g. ['fs', 'path'] for Node.js deps
```

All entries are built in parallel using `Promise.allSettled()`, allowing partial success.

### 5.2 xrmforge.config.json Schema

```json
{
  "build": {
    "outDir": "./dist/prefix_/JS",
    "target": "es2020",
    "sourcemap": true,
    "minify": true,
    "external": [],
    "entries": {
      "entry_name": {
        "input": "./src/forms/account-form.ts",
        "namespace": "Contoso.Account",
        "out": "Account/OnLoad.js"
      }
    }
  }
}
```

### 5.3 globalName Handling

esbuild automatically creates nested globals from dotted namespaces:
```javascript
// namespace: "Contoso.Account" produces:
var Contoso = Contoso || {};
Contoso.Account = (() => { return { onLoad, onSave }; })();
```

D365 event registration: `Contoso.Account.onLoad`.
