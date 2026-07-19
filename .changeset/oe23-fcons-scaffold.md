---
"@xrmforge/devkit": minor
"@xrmforge/cli": patch
---

Scaffold: file-scoped validate:form, hardened Check 3p, updated AGENT.md

- `validate-form.mjs` accepts optional file/dir/glob arguments to scope ESLint and
  the pattern checks to those files (handy for parallel conversion); tsc still runs
  project-wide, its out-of-scope errors are shown as info but do not gate. The
  argument-less run remains the full gate you commit/publish on (OE-23).
- Check 3p now also catches `as { [key: string]: unknown }`, the inline index
  signature that previously slipped a typed response past the gate (F-CONS-03).
- AGENT.md: the reader family takes the entity-cast response directly (OE-21),
  `normalizeGuid` from `@xrmforge/helpers` is documented (F-CONS-01), and
  `form-index.json` is the primary interface lookup after generate (OE-22).
