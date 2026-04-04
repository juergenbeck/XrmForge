# 15. CI/CD

## 15.1 GitHub Actions CI (`.github/workflows/ci.yml`)

**Auslöser:** Push auf main, Pull Requests gegen main.

**Matrix:** Node 20, Node 22 auf ubuntu-latest.

**Schritte:**
1. Checkout
2. pnpm einrichten (aus packageManager-Feld)
3. Node.js einrichten (Matrix-Version)
4. `pnpm install --frozen-lockfile`
5. `pnpm lint`
6. `pnpm -r exec tsc --noEmit` (Typecheck aller Packages)
7. `pnpm build`
8. `pnpm test`
9. Coverage (nur Node 22): `npx vitest run --coverage` in typegen

## 15.2 Release-Workflow (`.github/workflows/release.yml`)

**Auslöser:** Nach erfolgreicher CI bei Push auf main.

**Schritte:**
1. Checkout, pnpm einrichten, Node 22 einrichten
2. `pnpm install --frozen-lockfile`
3. `pnpm build`
4. Changesets-Action: erstellt Release-PR oder veröffentlicht auf npm

**Publish-Befehl:** `pnpm release` = `turbo run build && changeset publish`

## 15.3 Turbo-Pipeline

```
build:      dependsOn: [^build], outputs: [dist/**]
test:       dependsOn: [build]
typecheck:  dependsOn: [^build]
lint:       (keine Abhängigkeiten)
dev:        cache: false, persistent: true
clean:      cache: false
```

## 15.4 Changesets

Konfiguriert für öffentlichen npm-Zugriff, automatische Aktualisierung interner Abhängigkeiten auf Patch-Ebene. Veröffentlichung erfordert NPM_TOKEN Secret.

## 15.5 Veröffentlichungsreihenfolge

Aufgrund interner Abhängigkeiten: zuerst typegen, dann devkit, dann cli. Es muss `pnpm publish` verwendet werden (nicht `npm publish`), um `workspace:*`-Referenzen in echte Versionen aufzulösen.
