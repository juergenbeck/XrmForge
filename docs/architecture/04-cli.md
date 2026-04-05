# CLI Commands

### 4.1 `xrmforge generate`

Generates TypeScript declarations from a Dataverse environment.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--url <url>` | string | required | Dataverse environment URL |
| `--auth <method>` | string | required | Auth method: client-credentials, interactive, device-code, token |
| `--tenant-id <id>` | string | varies | Azure AD tenant ID |
| `--client-id <id>` | string | varies | Azure AD application ID |
| `--client-secret <s>` | string | varies | Client secret (client-credentials only) |
| `--token <token>` | string | varies | Pre-acquired bearer token (token auth only) |
| `--entities <list>` | string | - | Comma-separated entity logical names |
| `--solutions <list>` | string | - | Comma-separated solution unique names |
| `--output <dir>` | string | ./generated | Output directory |
| `--label-language <n>` | string | 1033 | Primary label language (LCID) |
| `--secondary-language <n>` | string | - | Secondary label language for JSDoc |
| `--no-forms` | flag | - | Skip form interface generation |
| `--no-optionsets` | flag | - | Skip OptionSet enum generation |
| `--actions` | flag | false | Generate Custom API executors |
| `--actions-filter <prefix>` | string | - | Filter Custom APIs by uniquename prefix |
| `--cache` | flag | false | Enable metadata caching for incremental generation |
| `--no-cache` | flag | - | Force full metadata refresh |
| `--cache-dir <dir>` | string | .xrmforge/cache | Cache directory |
| `-v, --verbose` | flag | false | Debug logging |

At least one of `--entities` or `--solutions` is required.

### 4.2 `xrmforge build`

Builds WebResources as IIFE bundles using esbuild (via @xrmforge/devkit).

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--watch` | flag | false | Watch mode with incremental rebuilds |
| `--minify` | flag | from config | Override minification setting |
| `--no-sourcemap` | flag | - | Disable source maps |
| `--out-dir <dir>` | string | from config | Override output directory |
| `-v, --verbose` | flag | false | Show error stacks |

Reads configuration from `xrmforge.config.json`.

### 4.3 `xrmforge init`

Scaffolds a new D365 form scripting project.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `[dir]` | positional | . | Target directory |
| `--name <name>` | string | dir name | Project name for package.json |
| `--prefix <prefix>` | string | contoso | Publisher prefix |
| `--namespace <ns>` | string | PascalCase(prefix) | Base namespace for scripts |
| `--skip-install` | flag | false | Skip npm install |
| `--force` | flag | false | Allow non-empty directories |

Generates 11 files: package.json, tsconfig.json, xrmforge.config.json, vitest.config.ts, .gitignore, AGENT.md, example-form.ts, example-form.test.ts, generated/.gitkeep, GitHub Actions CI, Azure DevOps Pipeline.
