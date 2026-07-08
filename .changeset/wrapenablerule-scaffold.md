---
"@xrmforge/devkit": patch
---

Scaffold a `wrapEnableRule` helper in `src/shared/error-handler.ts` for ribbon Enable Rules. Unlike a command, an Enable Rule is evaluated synchronously by the ribbon on every refresh and its return value decides button visibility/enablement, so the wrapper is synchronous and returns a real `boolean`. An `async` rule returns a Promise, which the ribbon always treats as truthy (the button is then permanently shown - a subtle, common legacy bug). `wrapEnableRule` fails closed (returns `false` on error) and only logs, never surfacing a form/app banner (a rule that runs on every refresh must not spam one). The quality-gate template (`validate-form.mjs` `HANDLER_WRAPPERS`) and the AGENT.md instructions accept it as the fifth error-handling wrapper.
