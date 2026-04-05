# 10. ESLint Plugin

## 10.1 Installation

```javascript
// eslint.config.js (Flat Config, ESLint v9)
import xrmforge from '@xrmforge/eslint-plugin';

export default [
  xrmforge.configs.recommended,
  // oder einzelne Regeln auswählen
];
```

## 10.2 Regeln

### no-xrm-page (error)

Verbietet die veraltete `Xrm.Page`-API (entfernt in D365 v9.0+).

```typescript
// Falsch
Xrm.Page.getAttribute("name");

// Richtig
const form = executionContext.getFormContext();
form.getAttribute("name");
```

### no-magic-optionset (warn)

Verbietet rohe Zahlen (>= 2) in Vergleichen mit `.getValue()`.

```typescript
// Falsch
if (attr.getValue() === 595300000) { }

// Richtig
import { StatusCode } from '../generated/optionsets/account';
if (attr.getValue() === StatusCode.Active) { }
```

### no-sync-webapi (error)

Verbietet synchrone XMLHttpRequest (`new XMLHttpRequest()` und `.open()` mit `async=false`).

```typescript
// Falsch
xhr.open("GET", url, false);

// Richtig
const data = await Xrm.WebApi.retrieveRecord("account", id);
```

### require-error-handling (warn)

Verlangt try/catch in exportierten async-Funktionen, die mit "on" beginnen (Event-Handler).

```typescript
// Falsch
export async function onLoad(ctx) {
  await fetch("/api");  // keine Fehlerbehandlung
}

// Richtig
export async function onLoad(ctx) {
  try { await fetch("/api"); }
  catch (error) { console.error(error); }
}
```

### require-namespace (warn)

Verbietet direkte `window.X = ...` oder `globalThis.X = ...` Zuweisungen. Stattdessen sollen Modul-Exports mit esbuild globalName verwendet werden.

```typescript
// Falsch
window.Contoso = { onLoad: function() {} };

// Richtig
export function onLoad(ctx: Xrm.Events.EventContext) {}
```
