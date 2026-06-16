# @xrmforge/cli

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
