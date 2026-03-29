# Contributing to XrmForge

Thank you for your interest in contributing to XrmForge! This document explains how to
get involved.

## Development Setup

### Prerequisites

- Node.js >= 20 (see `.node-version`)
- pnpm >= 9 (see `packageManager` in `package.json`)

### Getting Started

```bash
git clone https://github.com/juergenbeck/XrmForge.git
cd XrmForge
pnpm install
pnpm build
pnpm test
```

### Useful Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm lint` | ESLint |
| `pnpm clean` | Remove build artifacts |

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |
| `chore` | Build process, dependencies, tooling |
| `perf` | Performance improvement |

### Scope

Use the package name without the `@xrmforge/` prefix:

- `feat(typegen): add metadata client`
- `fix(cli): handle missing config file`
- `chore: update dependencies`

## Pull Requests

### Before Submitting

1. Ensure `pnpm build` passes
2. Ensure `pnpm test` passes (no skipped tests)
3. Ensure `pnpm typecheck` passes
4. Ensure `pnpm lint` passes
5. Add or update tests for your changes
6. Add a changeset if your change affects published packages (see below)

### Changesets

We use [Changesets](https://github.com/changesets/changesets) for versioning and changelog generation.

When your PR changes published package behavior:

```bash
pnpm changeset
```

This will prompt you to:
1. Select affected packages
2. Choose a semver bump type (patch/minor/major)
3. Write a summary of the change

The changeset file is committed with your PR. Maintainers merge changesets into
version bumps and CHANGELOG entries at release time.

### PR Checklist

- [ ] `pnpm build && pnpm test && pnpm typecheck && pnpm lint` all pass
- [ ] Tests added/updated for changes
- [ ] Changeset added (if applicable)
- [ ] No `console.log` in production code (use the Logger)
- [ ] No `any` casts without justification
- [ ] JSDoc on all public APIs

## Code Quality Standards

- **TypeScript strict mode** is enforced
- **No `console.log/warn/error`** in production code; use the `createLogger()` abstraction
- **Structured errors** via the `XrmForgeError` hierarchy; no plain `throw new Error()`
- **Generated types must extend `@types/xrm`**, never replace it
- **Every exported function needs at least one test**
- **ESM only** (`"type": "module"`)

## Project Architecture

See [README.md](README.md) for the package overview. The architecture document
is maintained separately by the core team.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
