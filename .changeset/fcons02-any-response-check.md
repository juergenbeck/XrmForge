---
"@xrmforge/devkit": minor
"@xrmforge/cli": patch
---

Add a quality-gate check for untyped (any) Xrm.WebApi.retrieveRecord responses (F-CONS-02).

`retrieveRecord<T = any>` returns `any` by default, so a response assigned without a cast,
type parameter, or type annotation is silently `any` - and no existing gate catches it
(no-explicit-any sees no explicit any, tsc is green, Check 3p only matches `as Record<...>`).
Passing such a response to a reader (parseLookup, expanded, ...) loses all field type-safety.

The new multi-line check "Untyped retrieveRecord response" in validate-form.mjs scans the whole
declaration expression (declaration to terminating `;`) and flags a response that is not typed
via `) as Entity`, `retrieveRecord<Entity>`, or a PascalCase annotation. It is deliberately not
the per-line checkPattern: the correct inline cast is usually multi-line with `as Entity` on the
closing line, which a per-line regex would false-flag. Verified live against markant (9 real
finds, 0 false positives). cli re-pins devkit.
