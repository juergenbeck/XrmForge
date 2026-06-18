# @xrmforge/cli

## 0.8.8

### Patch Changes

- Propagation bump: pulls devkit 0.7.23 (AGENT.md helper guidance + helpers ^0.10.0 scaffold pin,
  F-MAR7-03/F-LMA7-07/09) via workspace:* so `npx xrmforge init` scaffolds the updated guidance and
  pin. No cli source change.

## 0.8.7

### Patch Changes

- Propagation bump: pulls typegen 0.12.2 (barrel no longer export-stars action modules, F-LMA7-01)
  and devkit 0.7.22 via workspace:* so `npx xrmforge generate`/`init` use the fixed barrel and
  updated guidance. No cli source change.

## 0.8.6

### Patch Changes

- Propagation bump: pulls devkit 0.7.21 (AGENT.md testing-mock guidance + testing ^0.4.0 scaffold
  pin, F-MAR7-02) via workspace:* so `npx xrmforge init` scaffolds the updated guidance and pin.
  No cli source change.

## 0.8.5

### Patch Changes

- Propagation bump: pulls devkit 0.7.20 (AGENT.md Custom API executor guidance + helpers ^0.9.0
  scaffold pin, F-MAR7-01) via workspace:* so `npx xrmforge init` scaffolds the updated guidance and
  pin. No cli source change.

## 0.8.4

### Patch Changes

- Propagation bump: pulls devkit 0.7.19 (AGENT.md section 5b + validate-form.mjs lookup convention,
  F-LMA7-05) via workspace:* so `npx xrmforge init` scaffolds the updated guidance and gate. No cli
  source change.

## 0.8.3

### Patch Changes

- `init` next-steps print `xrmforge generate ... --output ./generated` instead of `./typings`,
  consistent with the generate default output and the scaffolded tsconfig `include` (K32-04).
- Bundles devkit 0.7.18 + typegen 0.12.1 (scaffold `generated/` + AGENT.md isFormType + apostrophe
  escaping) via the workspace dependency.

## 0.8.2

### Patch Changes

- Propagation bump: pulls devkit 0.7.17 (AGENT.md scaffold template now teaches `callCloudFlow`) via
  workspace:* so `npx xrmforge init` scaffolds the updated agent guidance. No cli source change.

## 0.8.1

### Patch Changes

- Propagation bump: pulls devkit 0.7.16 (scaffold helpers pin `^0.7.0`) via workspace:* so
  `npx xrmforge init` scaffolds projects on the current helpers minor. No cli source change.

## 0.8.0

### Minor Changes

- generate: full OE-12 credential resolution. A local `./.env` is now auto-loaded (via `dotenv`,
  without overriding real environment variables), and in an interactive terminal `generate` prompts
  for any connection/credential value still missing (URL, auth method, tenant/client/secret or token).
  Precedence per value: CLI flag > environment variable > `./.env` > `xrmforge.config.json` >
  interactive prompt. The prompt hides secret input, can persist the entered values to `./.env`
  (chmod 600 on POSIX) and prints `export XRMFORGE_*` lines; the auth method is not persisted (keep it
  in `xrmforge.config.json` or pass `--auth`). In a non-interactive context (CI) nothing is prompted -
  the usual missing-value error fires instead of hanging. New dependency: `dotenv` (zero-dependency).
  Pulls devkit 0.7.15 (scaffold `.gitignore` ignores `.env`, cli pin `^0.8.0`) via workspace:*.

## 0.7.0

### Minor Changes

- generate: connection and credentials now resolve from XRMFORGE_* environment variables
  (`XRMFORGE_URL`, `XRMFORGE_TENANT_ID`, `XRMFORGE_CLIENT_ID`, `XRMFORGE_CLIENT_SECRET`;
  `XRMFORGE_TOKEN` was already supported). Precedence per value: explicit CLI flag > env var >
  `xrmforge.config.json` (env is resolved before the config merge). Fixes K30-05: the CLI advised
  `XRMFORGE_CLIENT_SECRET` in two places but never read it. `buildAuthConfig` is now pure (no env
  reads, no warnings); the insecure-flag warnings for `--client-secret` / `--token` fire only for
  actual CLI flags, never for env-sourced values. Pulls devkit 0.7.14 (env-based CI scaffold
  templates) via workspace:*.

## 0.6.2

### Patch Changes

- Propagation bump: pulls devkit 0.7.13 + typegen 0.12.0 via workspace:* (no cli source change).

## 0.6.1

### Patch Changes

- Propagation bump: pulls devkit 0.7.12 + typegen 0.12.0 via workspace:* (no cli source change).

## 0.6.0

### Minor Changes

- config: `XrmForgeConfig` gains `actions` / `actionsFilter` so the Custom API scope is checkable and
  `generate --check` runs without reconstructed CLI options (Backlog D / F23-LMA-02). The `--actions`
  Commander default was removed so a `config.actions` value is no longer shadowed (CLI behavior
  unchanged via `?? false` in the orchestrator).

## 0.5.2

### Patch Changes

- Not published to npm (git-only interim; folded into 0.6.0). Pulled devkit 0.7.11 (Backlog A
  eslint-plugin 0.3.0 + CI/self-check template fixes) via workspace:*.

## 0.5.1

### Patch Changes

- Propagation bump: pulls typegen 0.11.1 + devkit 0.7.10 via workspace:* (CRLF-robust `--check`,
  F23-LMA-01).

## 0.5.0

### Minor Changes

- `xrmforge generate --check` CLI flag: read-only drift check with tri-state exit codes (OE-11
  release 2).

## 0.4.21

### Patch Changes

- Not published to npm (git-only interim, commit 313e6e6; folded into 0.5.0). Companion to the OE-11
  release-1 typegen 0.10.2 (deterministic-sorting prep).

## 0.4.20

### Patch Changes

- Updated dependencies
  - @xrmforge/devkit@0.7.7

## 0.4.19

### Patch Changes

- Updated dependencies
  - @xrmforge/typegen@0.10.1

## 0.4.18

### Patch Changes

- Updated dependencies
  - @xrmforge/devkit@0.7.6

## 0.4.17

### Patch Changes

- Updated dependencies
  - @xrmforge/devkit@0.7.5

## 0.4.16

### Patch Changes

- Updated dependencies
  - @xrmforge/devkit@0.7.4

## 0.4.15

### Patch Changes

- Updated dependencies
  - @xrmforge/devkit@0.7.3

## 0.4.14

### Patch Changes

- Updated dependencies
  - @xrmforge/typegen@0.10.0

## 0.4.13

### Patch Changes

- Updated dependencies
  - @xrmforge/devkit@0.7.2

## 0.4.12

### Patch Changes

- Updated dependencies
  - @xrmforge/devkit@0.7.1

## 0.4.11

### Patch Changes

- Updated dependencies
  - @xrmforge/devkit@0.7.0

## 0.4.10

### Patch Changes

- Quality fixes: eliminate raw string literals, add catch type annotations
  - testing: semantic constants for Xrm enum defaults (isolatedModules compatible)
  - webapi: catch (error: unknown) on all CRUD methods
  - cli: catch (error: unknown) on all command handlers
  - devkit: FormNotificationLevel.Error in error-handler.ts template
  - typegen: catch (err: unknown) in file-writer
- Updated dependencies
  - @xrmforge/devkit@0.6.1
  - @xrmforge/typegen@0.9.1

## 0.4.9

### Patch Changes

- Updated dependencies
  - @xrmforge/typegen@0.9.0
  - @xrmforge/devkit@0.6.0
