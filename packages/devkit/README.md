# @xrmforge/devkit

[![npm version](https://img.shields.io/npm/v/@xrmforge/devkit.svg)](https://www.npmjs.com/package/@xrmforge/devkit)
[![license](https://img.shields.io/npm/l/@xrmforge/devkit.svg)](https://github.com/juergenbeck/XrmForge/blob/main/LICENSE)

**Build orchestration and project scaffolding for Dynamics 365 Web Resources.** Wraps esbuild to produce IIFE bundles with named globals (the format D365 needs for form event binding) from a declarative config -- no `esbuild.config.js`, no `build.mjs`.

> Part of [XrmForge](https://github.com/juergenbeck/XrmForge#readme). This package powers `xrmforge build` and `xrmforge init`. Most users drive it through [`@xrmforge/cli`](https://www.npmjs.com/package/@xrmforge/cli); install it directly only to embed builds or scaffolding in your own tooling.

---

## Installation

```bash
npm install --save-dev @xrmforge/devkit
```

**Requirements:** Node.js 20 or higher. Bundles `esbuild` as a dependency.

---

## Declarative build config

Builds are driven by the `build` section of `xrmforge.config.json`. Each entry becomes one IIFE Web Resource exposed under a global namespace.

```jsonc
{
  "build": {
    "outDir": "./dist/contoso_/JS",   // default: ./dist
    "target": "es2020",                // default: es2020
    "sourcemap": true,                 // default: true
    "minify": true,                    // default: false
    "entries": {
      "account_form": {
        "input": "./src/forms/account-form.ts",  // required
        "namespace": "Contoso.AccountForm",        // required: D365 global for event binding
        "out": "Account/OnLoad.js"                 // optional: defaults to <entry-key>.js
      }
    }
  }
}
```

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| `entries` | yes | -- | Map of entry name to `{ input, namespace, out? }`. Must be non-empty. |
| `entries.*.input` | yes | -- | Path to the TypeScript source file. |
| `entries.*.namespace` | yes | -- | Global namespace (e.g. `Contoso.Account`) D365 calls handlers through. |
| `entries.*.out` | no | `<key>.js` | Output filename relative to `outDir`. |
| `outDir` | no | `./dist` | Output directory for bundles. |
| `target` | no | `es2020` | JavaScript target version. |
| `sourcemap` | no | `true` | Emit source maps. |
| `minify` | no | `false` | Minify output. |
| `bundler` | no | `esbuild` | Currently only `esbuild`. |
| `external` | no | `[]` | Modules to exclude from the bundle. |

---

## Via the CLI (recommended)

```bash
xrmforge build              # build all entries (parallel)
xrmforge build --watch      # watch mode, ~10ms incremental rebuilds
xrmforge build --minify
xrmforge build --no-sourcemap
```

See [`@xrmforge/cli`](https://www.npmjs.com/package/@xrmforge/cli).

---

## Programmatic API

```typescript
import {
  build,
  watch,
  validateBuildConfig,
  resolveBuildConfig,
  scaffoldProject,
  BuildError,
  BuildErrorCode,
} from '@xrmforge/devkit';

// Validate + resolve a raw config (throws BuildError with CONFIG_INVALID on bad input)
const config = resolveBuildConfig(validateBuildConfig(rawConfigFromJson));

// One-shot build -> BuildResult (per-entry output paths, sizes, timings)
const result = await build(config);

// Watch mode for incremental rebuilds; returns a disposer to stop watching
const { dispose } = await watch(config, { onRebuild: (r) => console.log('rebuilt', r) });
// ... later:
await dispose();

// Scaffold a new project (the engine behind `xrmforge init`)
await scaffoldProject(/* ScaffoldConfig */);
```

| Export | Purpose |
|--------|---------|
| `build(config, cwd?)` | Run all entries once. Returns `BuildResult`. |
| `watch(config, options?)` | Start watch mode (`onRebuild` callback). Returns `{ dispose }` to stop. |
| `validateBuildConfig(raw)` | Validate an untyped config; throws `BuildError` on failure. |
| `resolveBuildConfig(config)` | Apply defaults, returning a `ResolvedBuildConfig`. |
| `scaffoldProject(config)` | Generate a new project structure (`xrmforge init`). |
| `BuildError`, `BuildErrorCode` | Structured build errors. |

Exported types: `BuildConfig`, `BuildEntry`, `ResolvedBuildConfig`, `BuildResult`, `BuildResultEntry`, `ScaffoldConfig`, `ScaffoldResult`.

---

## Why IIFE?

D365 loads Web Resources via `<script>` tags and calls handlers by name (e.g. `Contoso.AccountForm.onLoad`). The IIFE format wraps your module and exposes its exports under the configured global namespace, so the form event system can reach them.

## Documentation

Full guide -- building, shared libraries, deployment: [XrmForge on GitHub](https://github.com/juergenbeck/XrmForge#readme).

## License

[MIT](https://github.com/juergenbeck/XrmForge/blob/main/LICENSE) (c) XrmForge Contributors.
