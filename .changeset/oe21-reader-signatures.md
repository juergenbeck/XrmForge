---
"@xrmforge/helpers": minor
---

Web API response readers accept an entity-cast response directly (OE-21)

`parseLookup`, `parseLookups`, `parseFormattedValue`, `expanded` and `expandedMany`
now take a `WebApiRecord` (`object & { length?: never }`) instead of
`Record<string, unknown>`. A response cast to a generated Entity interface can be
passed straight in - no separate `as Record<string, unknown>` cast and no leaving
it as `any` (which silently dropped type safety on every field). A whole result
collection passed by mistake (a forgotten `[0]`) is still rejected at compile time.
Backward compatible: `Record<string, unknown>` and `any` still work.
