/**
 * @xrmforge/helpers - Attribute submit helpers
 *
 * Set or clear an attribute and force it to be submitted (SubmitMode.Always).
 * D365 AutoSave only submits dirty attributes; programmatically set values on
 * locked/calculated or off-form fields can otherwise be silently dropped.
 */

import { SubmitMode } from './xrm-constants.js';

/**
 * Clear an attribute (`setValue(null)`) and force it to be submitted.
 *
 * Prefer this over a generic `setAndSubmit(attr, null)`: passing a literal `null`
 * as the value makes TypeScript infer the value type as `null` and fights the
 * attribute's real value type (F-LMA7-09). A dedicated clear helper has no value
 * parameter, so there is nothing to mis-infer.
 *
 * @param attr - A settable attribute (e.g. `form.revenue` from the typedForm proxy)
 */
export function clearAndSubmit(attr: {
  setValue(value: null): void;
  setSubmitMode(mode: Xrm.SubmitMode): void;
}): void {
  attr.setValue(null);
  attr.setSubmitMode(SubmitMode.Always);
}

/**
 * Set an off-form attribute (loaded by D365 but not on the current form layout,
 * reached via the typedForm `$unsafe` proxy) and force submit.
 *
 * The typedForm proxy only exposes on-form fields; off-form fields go through
 * `$unsafe()`, which returns `Attribute | null`. This helper bundles the null
 * check, `setValue` and `setSubmitMode(Always)` (F-LMA7-07). For on-form fields
 * use the typed proxy directly (`form.field.setValue(v)` + `setSubmitMode`).
 *
 * @param form - The typedForm proxy (anything exposing `$unsafe`)
 * @param field - The off-form attribute logical name (use an entity Fields enum, never a raw string)
 * @param value - The value to set (off-form fields are untyped)
 * @returns `true` if the field existed and was set, `false` if it was absent
 */
export function setUnsafeAndSubmit(
  form: { $unsafe(name: string): Xrm.Attributes.Attribute | null },
  field: string,
  value: unknown,
): boolean {
  const attr = form.$unsafe(field);
  if (attr == null) return false;
  (attr as { setValue(value: unknown): void }).setValue(value);
  attr.setSubmitMode(SubmitMode.Always);
  return true;
}

/**
 * Set an on-form attribute's value and force it to be submitted (`SubmitMode.Always`).
 *
 * The single most common programmatic-set idiom: D365 AutoSave only submits dirty
 * attributes, so a value set in code without `setSubmitMode(Always)` can be silently
 * dropped. This collapses the two-line `attr.setValue(v); attr.setSubmitMode(Always)`
 * into one type-safe call (the value type is taken from the attribute's `setValue`,
 * so `setAndSubmit(form.revenue, 150000)` rejects a wrong-typed value).
 *
 * Use the typedForm proxy attribute directly (`setAndSubmit(form.revenue, 150000)`).
 * For off-form fields use {@link setUnsafeAndSubmit} (bundles the `$unsafe` null check);
 * to clear a value use {@link clearAndSubmit} (avoids mis-inferring the type from `null`).
 *
 * Explicit opt-in by design: it deliberately does NOT change `setValue` semantics.
 * Some programmatic sets legitimately must NOT submit (read-only display fields,
 * fields set only to trigger an onChange).
 *
 * @param attr - A settable attribute (e.g. `form.revenue` from the typedForm proxy)
 * @param value - The value to set; its type is taken from the attribute's `setValue`
 */
export function setAndSubmit<T>(
  attr: { setValue(value: T): void; setSubmitMode(mode: Xrm.SubmitMode): void },
  value: T,
): void {
  attr.setValue(value);
  attr.setSubmitMode(SubmitMode.Always);
}
