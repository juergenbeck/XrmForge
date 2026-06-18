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
