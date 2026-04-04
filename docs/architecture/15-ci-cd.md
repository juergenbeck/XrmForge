# CI/CD

### 15.1 GitHub Actions CI (`.github/workflows/ci.yml`)

**Triggers:** Push to main, Pull Requests against main.

**Matrix:** Node 20, Node 22 on ubuntu-latest.

**Steps:**
1. Checkout
2. Setup pnpm (from packageManager field)
3. Setup Node.js (matrix version)
4. `pnpm install --frozen-lockfile`
5. `pnpm lint`
6. `pnpm -r exec tsc --noEmit` (typecheck all packages)
7. `pnpm build`
8. `pnpm test`
9. Coverage (Node 22 only): `npx vitest run --coverage` in typegen

### 15.2 Release Workflow (`.github/workflows/release.yml`)

**Triggers:** After successful CI on push to main.

**Steps:**
1. Checkout, setup pnpm, setup Node 22
2. `pnpm install --frozen-lockfile`
3. `pnpm build`
4. Changesets action: creates Release PR or publishes to npm

**Publish command:** `pnpm release` = `turbo run build && changeset publish`

### 15.3 Turbo Pipeline

```
build:      dependsOn: [^build], outputs: [dist/**]
test:       dependsOn: [build]
typecheck:  dependsOn: [^build]
lint:       (no dependencies)
dev:        cache: false, persistent: true
clean:      cache: false
```

### 15.4 Changesets

Configured for public npm access, auto-update internal dependencies on patch level. Publish requires NPM_TOKEN secret.

### 15.5 Publishing Order

Due to internal dependencies: typegen first, then devkit, then cli. Must use `pnpm publish` (not `npm publish`) to resolve `workspace:*` references to real versions.
