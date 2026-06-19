# @xrmforge/cli

[![npm version](https://img.shields.io/npm/v/@xrmforge/cli.svg)](https://www.npmjs.com/package/@xrmforge/cli)
[![license](https://img.shields.io/npm/l/@xrmforge/cli.svg)](https://github.com/juergenbeck/XrmForge/blob/main/LICENSE)

**The command-line entry point for XrmForge -- type-safe TypeScript for Dynamics 365 CE / Model-Driven Apps.**

XrmForge reads your Dataverse metadata and generates TypeScript declarations that turn runtime errors into compile-time errors, so you catch typos, wrong types, missing fields, and bad action parameters before they reach production. This package provides the `xrmforge` command: scaffold a project, generate types, and build deployable Web Resources.

> This is the CLI. It is the recommended starting point for most users. For the full framework documentation (concepts, deployment, debugging, troubleshooting), see the [XrmForge repository on GitHub](https://github.com/juergenbeck/XrmForge#readme).

---

## Installation

Global (gives you the `xrmforge` command everywhere):

```bash
npm install -g @xrmforge/cli
```

Or per project (recommended for reproducible CI builds; run it via `npx xrmforge`):

```bash
npm install --save-dev @xrmforge/cli @types/xrm typescript esbuild
```

> **Reproducible CLI version.** After a local install, `npx xrmforge ...` runs the version pinned in your `package.json`. Avoid `npx @xrmforge/cli@latest ...` *without* a local install: npx caches the first download and may keep serving a stale version. For one-off runs, pin an exact version (`npx @xrmforge/cli@<version> ...`).

**Requirements:** Node.js 20 or higher.

---

## Commands

The CLI exposes three commands:

| Command | Purpose |
|---------|---------|
| `xrmforge init` | Scaffold a new XrmForge project (tsconfig, build config, AGENT.md, example structure). |
| `xrmforge generate` | Read Dataverse metadata and generate typed `.ts` declarations. |
| `xrmforge build` | Bundle form scripts into IIFE Web Resources for D365 upload. |

Run `xrmforge <command> --help` for the full, authoritative flag list of any command.

---

### `xrmforge init`

Scaffolds a ready-to-use project: `tsconfig.json`, `xrmforge.config.json`, an `AGENT.md` (instructions for AI coding assistants), a `.gitignore`, a `.gitattributes` pinning generated files to LF line endings, and an example source layout.

```bash
mkdir my-d365-project
cd my-d365-project
xrmforge init
```

Use `--force` to scaffold into a non-empty directory. Existing files are skipped (only the missing ones are written), so `--force` never overwrites your existing work.

---

### `xrmforge generate`

Reads entity, form, OptionSet, and Custom API metadata from your environment and writes typed `.ts` files into the output directory.

```bash
xrmforge generate \
  --url https://myorg.crm4.dynamics.com \
  --auth interactive \
  --tenant-id YOUR_TENANT_ID \
  --client-id 51f81489-12ee-4a9e-aaae-a2591f45987d \
  --entities account,contact,opportunity \
  --output ./generated \
  --secondary-language 1031
```

The client ID above is Microsoft's well-known sample App ID, so no own App Registration is needed for `interactive` and `device-code` auth.

**Frequently used flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--url <url>` | Dataverse environment URL. Falls back to `XRMFORGE_URL`. | Required |
| `--auth <method>` | `interactive`, `client-credentials`, `device-code`, or `token`. | Required |
| `--tenant-id <id>` | Azure AD tenant ID. Falls back to `XRMFORGE_TENANT_ID`. | Required (most methods) |
| `--client-id <id>` | Azure AD application (client) ID. Falls back to `XRMFORGE_CLIENT_ID`. | Required (most methods) |
| `--client-secret <secret>` | Client secret (`client-credentials`). Prefer `XRMFORGE_CLIENT_SECRET`. | -- |
| `--token <token>` | Pre-acquired Bearer token (`token` auth). Prefer `XRMFORGE_TOKEN`. | -- |
| `--entities <list>` | Comma-separated entity logical names. | -- |
| `--solutions <list>` | Comma-separated solution unique names (discovers all their entities). | -- |
| `--output <dir>` | Output directory for generated files. | `./generated` |
| `--label-language <code>` | Primary label language LCID. | `1033` |
| `--secondary-language <code>` | Secondary label LCID for dual-language JSDoc. | -- |
| `--actions` | Generate typed Custom API Action/Function executors. | Off |
| `--actions-filter <prefix>` | Filter Custom APIs by unique-name prefix. | -- |
| `--cache` | Metadata caching for incremental generation (much faster reruns). | Off |
| `--check` | Drift check: compare against output without writing. Exit 0/1/2. | Off |
| `-v, --verbose` | Verbose/debug logging. | Off |

Either `--entities` or `--solutions` (or both) must be specified. Connection values also resolve from `XRMFORGE_*` environment variables and a local `.env` file, so secrets never need to appear on the command line.

**Drift detection.** `xrmforge generate --check` runs the full generation in memory and compares it byte-for-byte against the output directory **without writing anything**. Exit codes follow the `terraform plan -detailed-exitcode` convention: `0` = up to date, `1` = error, `2` = drift detected. Ideal as a nightly CI gate against silent metadata drift.

---

### `xrmforge build`

Produces IIFE bundles (the format D365 needs for global form event binding) from a declarative `build` section in `xrmforge.config.json` -- no `esbuild.config.js` or `build.mjs` required.

```jsonc
// xrmforge.config.json
{
  "build": {
    "outDir": "./dist/contoso_/JS",
    "target": "es2020",
    "sourcemap": true,
    "minify": true,
    "entries": {
      "account_form": {
        "input": "./src/forms/account-form.ts",
        "namespace": "Contoso.AccountForm",
        "out": "Account/OnLoad.js"
      }
    }
  }
}
```

```bash
xrmforge build              # Build all entries (parallel IIFE bundles)
xrmforge build --watch      # Watch mode, ~10ms incremental rebuilds
xrmforge build --minify     # Override: minify output
xrmforge build --no-sourcemap
```

Bundling is powered by [`@xrmforge/devkit`](https://www.npmjs.com/package/@xrmforge/devkit).

---

## Five-minute quick start

```bash
# 1. Scaffold
mkdir my-d365-project && cd my-d365-project
npx xrmforge init

# 2. Generate types from your environment
npx xrmforge generate \
  --url https://myorg.crm4.dynamics.com \
  --auth interactive \
  --tenant-id YOUR_TENANT_ID \
  --client-id 51f81489-12ee-4a9e-aaae-a2591f45987d \
  --entities account,contact \
  --output ./generated

# 3. Type-check
npx tsc --noEmit

# 4. Build deployable Web Resources
npx xrmforge build
```

Then write a form script using the generated types:

```typescript
import type { AccountMainFormTypeInfo } from '../../generated/forms/account.js';
import { typedForm } from '@xrmforge/helpers';

export function onLoad(executionContext: Xrm.Events.EventContext): void {
  const form = typedForm<AccountMainFormTypeInfo>(executionContext.getFormContext());
  if (!form.name.getValue()) {
    form.$context.ui.setFormNotification('Account name is required.', 'WARNING', 'name-warning');
  }
}
```

---

## The XrmForge packages

`@xrmforge/cli` ties the framework together. The other packages can also be used on their own:

| Package | Role |
|---------|------|
| [`@xrmforge/typegen`](https://www.npmjs.com/package/@xrmforge/typegen) | Metadata reading and type-generation engine (used by `generate`). |
| [`@xrmforge/helpers`](https://www.npmjs.com/package/@xrmforge/helpers) | Browser-safe runtime: `select()`, `parseLookup()`, `typedForm()`, Xrm constants, action executors. |
| [`@xrmforge/webapi`](https://www.npmjs.com/package/@xrmforge/webapi) | Type-safe `Xrm.WebApi` client with a fluent query builder. |
| [`@xrmforge/testing`](https://www.npmjs.com/package/@xrmforge/testing) | Type-safe form-script mocks: `createFormMock()`, `setupXrmMock()`. |
| [`@xrmforge/devkit`](https://www.npmjs.com/package/@xrmforge/devkit) | Build orchestration and scaffolding (used by `build` and `init`). |
| [`@xrmforge/eslint-plugin`](https://www.npmjs.com/package/@xrmforge/eslint-plugin) | D365-specific ESLint rules. |

---

## Documentation

Full guide -- authentication, Azure App Registration, generated-type patterns, building, deployment, debugging, troubleshooting -- lives in the [main README on GitHub](https://github.com/juergenbeck/XrmForge#readme).

## License

[MIT](https://github.com/juergenbeck/XrmForge/blob/main/LICENSE) (c) XrmForge Contributors.
