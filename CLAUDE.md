# CLAUDE.md - XrmForge

This is the **open-source code repo** for XrmForge.
Architecture, decisions, reviews, and skills live in the separate **XrmForge-Workspace** repo.

## Workspace Reference

Full collaboration rules, architecture docs, session state, and skills are in:
`C:\Users\Juerg\Source\repo\XrmForge-Workspace\`

At session start, always read the Workspace's `CLAUDE.md` and `ZUSAMMENARBEIT.md` first.

## Code Quality

- Every change must pass: `pnpm build && pnpm test && pnpm typecheck && pnpm lint`
- No module without: error handling, structured logging, unit tests, JSDoc
- No console.log/warn/error in production code (use the Logger abstraction)
- No `any` casts without justification
- TypeScript strict mode enforced

## Architecture

- Monorepo: pnpm + Turborepo
- Packages under `packages/` with `@xrmforge/` npm scope
- Generated types extend `@types/xrm` (never replace)
- Build: esbuild (default) + webpack (compatibility)
- Auth: @azure/identity (MSAL only)

## Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`
Scope: package name without `@xrmforge/` prefix (e.g., `feat(typegen): add metadata client`)

## Changesets

For changes that affect published packages, add a changeset:

```bash
pnpm changeset
```

See `CONTRIBUTING.md` for details.

## Language

- Code, comments, docs, commit messages: **English**
- Communication with Jürgen: **German with proper umlauts (ä, ö, ü, ß)**
