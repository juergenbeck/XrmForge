# 5. Build-Architektur

## 5.1 esbuild IIFE-Bundles

XrmForge verwendet esbuild, um IIFE-Bundles (Immediately Invoked Function Expression) für Dynamics 365 zu erstellen. D365 erfordert, dass Skripte als namespace.function registriert werden (z.B. `Contoso.Account.onLoad`).

**esbuild-Konfiguration pro Eintrag:**
```
format: 'iife'
bundle: true
globalName: entry.namespace    // z.B. 'Contoso.Account'
target: config.target          // Standard: 'es2020'
minify: config.minify
sourcemap: config.sourcemap
external: config.external      // z.B. ['fs', 'path'] für Node.js-Abhängigkeiten
```

Alle Einträge werden parallel mit `Promise.allSettled()` gebaut, was Teilerfolge ermöglicht.

## 5.2 xrmforge.config.json Schema

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

## 5.3 globalName-Behandlung

esbuild erstellt automatisch verschachtelte Globals aus gepunkteten Namespaces:
```javascript
// namespace: "Contoso.Account" erzeugt:
var Contoso = Contoso || {};
Contoso.Account = (() => { return { onLoad, onSave }; })();
```

D365-Event-Registrierung: `Contoso.Account.onLoad`.
