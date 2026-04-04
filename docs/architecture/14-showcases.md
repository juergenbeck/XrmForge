# Showcases

### 14.1 Markant WebResources (Production Showcase)

Located in the XrmForge-Workspace repository under `docs/07_showcase/markant-webresources/`.

- **30 WebResources** in `src/forms/` (account, contact, opportunity, lead, quote, email, task, etc.)
- **1 shared library** (GDPR retention UI)
- **9 test files** with 59 tests
- **79 generated typings:** 25 form interfaces, 28 entity interfaces, 22 OptionSet files, 4 action executors
- **esbuild build** via xrmforge.config.json (32 entries)
- **Deploy script** (deploy.mjs) with @azure/identity auth, incremental deployment, hash-based change detection
- **27 entities, 236 OptionSet enums, 95 form interfaces, 7 Custom API executors**

### 14.2 LMApp WebResources (KI Comparison Showcase)

Created during the KI comparison tests (Session 9). 18 legacy JavaScript form scripts (~8,400 lines) converted to TypeScript with XrmForge patterns.

- **19 WebResources** with Fields Enums, EntityNames, OptionSet Enums
- **84 tests** in 8 test files
- **XrmForge-optimized:** All 10 AGENT.md rules applied (FormContext cast, Fields Enum, EntityNames, OptionSet Enums, shared getLookupObject, Tab Enums)
