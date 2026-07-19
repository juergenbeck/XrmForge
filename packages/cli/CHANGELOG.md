# @xrmforge/cli

## 0.10.3

### Patch Changes

- c9277bb: Scaffold: file-scoped validate:form, hardened Check 3p, updated AGENT.md
  - `validate-form.mjs` accepts optional file/dir/glob arguments to scope ESLint and
    the pattern checks to those files (handy for parallel conversion); tsc still runs
    project-wide, its out-of-scope errors are shown as info but do not gate. The
    argument-less run remains the full gate you commit/publish on (OE-23).
  - Check 3p now also catches `as { [key: string]: unknown }`, the inline index
    signature that previously slipped a typed response past the gate (F-CONS-03).
  - AGENT.md: the reader family takes the entity-cast response directly (OE-21),
    `normalizeGuid` from `@xrmforge/helpers` is documented (F-CONS-01), and
    `form-index.json` is the primary interface lookup after generate (OE-22).

- Updated dependencies [c9277bb]
- Updated dependencies [c9277bb]
  - @xrmforge/typegen@0.20.0
  - @xrmforge/devkit@0.8.0

## 0.10.2

### Patch Changes

- Scaffold `eslint.config.js` now also ignores `legacy-reference/**`, so `pnpm lint` (`eslint .`) stays green on migration-reference code that is intentionally left unconverted. This keeps the lint gate aligned with validate-form (`eslint src/`). Fixes the A71-03/F-MK13-01 regression where the ignore lived only in the generated showcase config and was lost on reset.
- Updated dependencies
  - @xrmforge/devkit@0.7.41

## 0.10.1

### Patch Changes

- 45f4df4: Scaffold a `wrapEnableRule` helper in `src/shared/error-handler.ts` for ribbon Enable Rules. Unlike a command, an Enable Rule is evaluated synchronously by the ribbon on every refresh and its return value decides button visibility/enablement, so the wrapper is synchronous and returns a real `boolean`. An `async` rule returns a Promise, which the ribbon always treats as truthy (the button is then permanently shown - a subtle, common legacy bug). `wrapEnableRule` fails closed (returns `false` on error) and only logs, never surfacing a form/app banner (a rule that runs on every refresh must not spam one). The quality-gate template (`validate-form.mjs` `HANDLER_WRAPPERS`) and the AGENT.md instructions accept it as the fifth error-handling wrapper.
- Updated dependencies [45f4df4]
  - @xrmforge/devkit@0.7.40

## 0.9.3

### Patch Changes

- Propagate `@xrmforge/typegen@0.18.0` (HTTP client + OData sanitizers migrated onto the shared
  `@xrmforge/dataverse-core` runner/transport; public API and behaviour unchanged). No cli source change.

## 0.9.2

### Patch Changes

- Propagate `@xrmforge/typegen@0.17.0` (per-entity `XxxFieldKinds` constant for `typedFields`, OE-16) and
  `@xrmforge/devkit@0.7.38` (AGENT.md `typedFields` docs + scaffold helpers pin `^0.15.0`). No cli source
  change.

## 0.9.1

### Patch Changes

- Propagate `@xrmforge/typegen@0.16.0` (standalone EntityName fields kept via AttributeOf, F-LMA11-04) and
  `@xrmforge/devkit@0.7.37` (round-11 template fixes: scaffold pins, polymorphic `@odata.bind` AGENT.md,
  validate-form double-quote FetchXML). No cli source change.

## 0.9.0

### Minor Changes

- Propagate `@xrmforge/typegen@0.15.0` (new generated `XxxExpands` enum for polymorphic-lookup `$expand`,
  F-MK9-08-Sub) and `@xrmforge/devkit@0.7.36` (AGENT.md `XxxExpands` template fix). No cli source change.

## 0.8.21

### Patch Changes

- Propagate `@xrmforge/devkit@0.7.35` (HTML WebResources first-class in the scaffold: `wrapWebResource`,
  Check-3l wrapper list, `lint`/`validate:form` scripts, happy-dom, AGENT.md updates; Runde 10 OE-14). No cli
  source change.

## 0.8.20

### Patch Changes

- Propagate `@xrmforge/typegen@0.14.2` (shared enum-member-naming refactor, R46-07) and
  `@xrmforge/devkit@0.7.34` (AGENT.md template: polymorphic `$expand` + HTML WebResources, R46-02). No cli
  source change.

## 0.8.19

### Patch Changes

- Propagate `@xrmforge/typegen@0.14.1` (metadata cache version bump, invalidates stale pre-0.14.0 caches so
  the F-MK9-09 MultiSelect fix is not masked, R46-01). No cli source change.

## 0.8.18

### Patch Changes

- Propagate `@xrmforge/helpers@0.13.0` (`expanded`/`expandedMany`, F-MK9-08) and `@xrmforge/devkit@0.7.33`
  (scaffold helpers pin + AGENT.md). No cli source change.

## 0.8.17

### Patch Changes

- Propagate `@xrmforge/typegen@0.14.0` (SchemaName-based Fields enum members, F-MK9-05/07; MultiSelect choice
  resolution, F-MK9-09) and `@xrmforge/devkit@0.7.32` (AGENT.md naming note). No cli source change.

## 0.8.16

### Patch Changes

- Propagate devkit 0.7.31 (scaffold pins helpers `^0.12.0` for `addAppNotification` `autoHideMs`,
  F-MK9-10) and helpers 0.12.0. No cli source change.

## 0.8.15

### Patch Changes

- Propagate devkit 0.7.30 (scaffold `error-handler.ts`: generic `wrapCommand<TArgs>` + new
  `wrapGridCommand` for subgrid commands with an app-level error banner, F-MK9-02). No cli source change.

## 0.8.14

### Patch Changes

- Propagate `@xrmforge/typegen@0.13.2` (tree-shakeable Custom API executors via `/* @__PURE__ */`,
  F-LMA9-01) and `@xrmforge/devkit@0.7.29` (scaffold testing `^0.6.0` + AGENT.md NavigationProperties path
  and pitfalls, F-MK9-01/04). No cli source change.

## 0.8.13

### Patch Changes

- Propagate devkit 0.7.28 (AGENT.md template: raw FormContext + named constants is the supported multi-form pattern; the planned per-entity union FormTypeInfo was rejected, OE-13). No cli source change.

## 0.8.12

### Patch Changes

- Propagate devkit 0.7.27 (AGENT.md template: cross-form pattern + section-toggle clarification). No cli source change.

## 0.8.11

### Patch Changes

- Fix `init --force` description in README: existing files are skipped (only missing ones written),
  not overwritten -- the prose said the opposite and contradicted `xrmforge init --help`. Docs only,
  no code change.

## 0.8.10

### Patch Changes

- Add package README (rendered on npmjs.com). Docs only; propagation pulls typegen 0.13.1 + devkit
  0.7.25 via workspace:\*.

## 0.8.9

### Patch Changes

- Propagation bump: pulls typegen 0.13.0 (form-mapping `fields`/`isMain`, F-MAR7-04; typed section
  ItemCollection base, F-LMA7-10) and devkit 0.7.24 (AGENT.md pitfall #9, F-LMA7-11) via workspace:\*
  so `npx xrmforge generate`/`init` use them. No cli source change.

## 0.8.8

### Patch Changes

- Propagation bump: pulls devkit 0.7.23 (AGENT.md helper guidance + helpers ^0.10.0 scaffold pin,
  F-MAR7-03/F-LMA7-07/09) via workspace:\* so `npx xrmforge init` scaffolds the updated guidance and
  pin. No cli source change.

## 0.8.7

### Patch Changes

- Propagation bump: pulls typegen 0.12.2 (barrel no longer export-stars action modules, F-LMA7-01)
  and devkit 0.7.22 via workspace:\* so `npx xrmforge generate`/`init` use the fixed barrel and
  updated guidance. No cli source change.

## 0.8.6

### Patch Changes

- Propagation bump: pulls devkit 0.7.21 (AGENT.md testing-mock guidance + testing ^0.4.0 scaffold
  pin, F-MAR7-02) via workspace:\* so `npx xrmforge init` scaffolds the updated guidance and pin.
  No cli source change.

## 0.8.5

### Patch Changes

- Propagation bump: pulls devkit 0.7.20 (AGENT.md Custom API executor guidance + helpers ^0.9.0
  scaffold pin, F-MAR7-01) via workspace:\* so `npx xrmforge init` scaffolds the updated guidance and
  pin. No cli source change.

## 0.8.4

### Patch Changes

- Propagation bump: pulls devkit 0.7.19 (AGENT.md section 5b + validate-form.mjs lookup convention,
  F-LMA7-05) via workspace:\* so `npx xrmforge init` scaffolds the updated guidance and gate. No cli
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
  workspace:\* so `npx xrmforge init` scaffolds the updated agent guidance. No cli source change.

## 0.8.1

### Patch Changes

- Propagation bump: pulls devkit 0.7.16 (scaffold helpers pin `^0.7.0`) via workspace:\* so
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
  Pulls devkit 0.7.15 (scaffold `.gitignore` ignores `.env`, cli pin `^0.8.0`) via workspace:\*.

## 0.7.0

### Minor Changes

- generate: connection and credentials now resolve from XRMFORGE\__ environment variables
  (`XRMFORGE_URL`, `XRMFORGE_TENANT_ID`, `XRMFORGE_CLIENT_ID`, `XRMFORGE_CLIENT_SECRET`;
  `XRMFORGE_TOKEN` was already supported). Precedence per value: explicit CLI flag > env var >
  `xrmforge.config.json` (env is resolved before the config merge). Fixes K30-05: the CLI advised
  `XRMFORGE_CLIENT_SECRET` in two places but never read it. `buildAuthConfig` is now pure (no env
  reads, no warnings); the insecure-flag warnings for `--client-secret` / `--token` fire only for
  actual CLI flags, never for env-sourced values. Pulls devkit 0.7.14 (env-based CI scaffold
  templates) via workspace:_.

## 0.6.2

### Patch Changes

- Propagation bump: pulls devkit 0.7.13 + typegen 0.12.0 via workspace:\* (no cli source change).

## 0.6.1

### Patch Changes

- Propagation bump: pulls devkit 0.7.12 + typegen 0.12.0 via workspace:\* (no cli source change).

## 0.6.0

### Minor Changes

- config: `XrmForgeConfig` gains `actions` / `actionsFilter` so the Custom API scope is checkable and
  `generate --check` runs without reconstructed CLI options (Backlog D / F23-LMA-02). The `--actions`
  Commander default was removed so a `config.actions` value is no longer shadowed (CLI behavior
  unchanged via `?? false` in the orchestrator).

## 0.5.2

### Patch Changes

- Not published to npm (git-only interim; folded into 0.6.0). Pulled devkit 0.7.11 (Backlog A
  eslint-plugin 0.3.0 + CI/self-check template fixes) via workspace:\*.

## 0.5.1

### Patch Changes

- Propagation bump: pulls typegen 0.11.1 + devkit 0.7.10 via workspace:\* (CRLF-robust `--check`,
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
