---
"@xrmforge/typegen": minor
---

Emit a slim form-index.json next to form-mapping.json (OE-22)

`generate` now also writes `form-index.json`: the per-entity form list
(formName / interface / fieldsEnum / tabsEnum / isMain) WITHOUT the large per-form
`fields` arrays. It is the fast lookup for interface and main-form resolution that
does not need to load the full mapping (which grows to hundreds of KB once every
field set is listed). `form-mapping.json` is unchanged and still carries `fields`
for the rarer "which form binds field X?" question.
