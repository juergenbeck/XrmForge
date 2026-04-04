# Design Principles

The 18 design principles that govern all XrmForge development:

1. **Extend, don't replace** - Types build on @types/xrm, never override them.
2. **TypeScript all the way** - 100% TypeScript-native. No .NET, no ADAL.
3. **Code must build** - Every work step ends with green build + tests.
4. **Research before speed** - Investigate, compare, decide, then implement. Never guess.
5. **No module without basics** - Error handling, logging, unit tests, JSDoc on all public APIs.
6. **Monorepo discipline** - Each package standalone, no circular deps, barrel exports.
7. **Enterprise resilience** - Retry + exponential backoff, rate-limit awareness, token caching, read-only default.
8. **esbuild-first, webpack-compatible** - Default: esbuild (fast). webpack stays supported. IIFE output for D365.
9. **MSAL-only authentication** - Only @azure/identity (no legacy ADAL). Three flows: client credentials, browser, device code.
10. **Review required** - After every step, immediate critical review (6 dimensions). No asking if review is wanted.
11. **Session state required** - session-state.md updated, changelog written, open questions tracked.
12. **No half measures** - Every step completed fully: green build + tests + review before next step.
13. **Informed architecture decisions** - Research, compare, recommend with pros/cons, get decision, persist.
14. **Abstraction over vendor lock-in** - External dependencies behind interfaces (parser, auth, bundler).
15. **Dual-language labels** - Primary language (1033/English) for identifiers, secondary in JSDoc. German umlauts transliterated.
16. **Review with research and live verification** - Internet research, live D365 verification, production code checks, cite sources.
17. **Challenge postponement** - "Later" check: Will it get harder? API contract? Real effort? Technical reasons?
18. **Read-only default for Dataverse access** - DataverseHttpClient defaults to readOnly: true. Write access is an explicit opt-in.
