# Technical Debt

### 16.1 Known Issues

| Issue | Status | Priority |
|-------|--------|----------|
| parseLookup/select not adopted by AI assistants | Open | High |
| release.yml double runs (CI triggers release, release re-triggers CI) | Open | Low |
| No integration tests against live Dataverse | Open (OE-4) | Medium |
| @xrmforge/webapi has no Action/Function support | Accepted | Low |
| devDependency versions in scaffolded package.json are pinned to old versions | Open | Low |

### 16.2 Accepted Limitations

- **const enum limitation:** Resolved in typegen 0.8.0. Generated output is now `.ts` ES modules, so `const enum` works directly with vitest and other test frameworks.
- **Grid.refresh() requires `as any`:** Not typed in @types/xrm.
- **Single solution per entity:** If an entity appears in multiple solutions, it is only generated once.
