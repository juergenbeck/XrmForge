/**
 * Account Form - onLoad Event Handler
 *
 * Demonstrates XrmForge compile-time safety with the typedForm() proxy:
 * - `form.fieldname` returns the exact typed Attribute (no getAttribute chains)
 * - `form.controls.fieldname` returns the exact typed Control (no casts)
 * - Unknown field names are compile errors (no string fallback)
 */

import { typedForm } from '@xrmforge/helpers';
import type { AccountFormTypeInfo } from '../generated/forms/account.js';

/**
 * onLoad handler for the Account main form.
 */
export function onLoad(executionContext: Xrm.Events.EventContext): void {
  // typedForm<...TypeInfo> uses the generated FormTypeInfo (fields + attribute/
  // control maps) for reliable extraction. Passing the bare form interface
  // relies on overload inference that breaks across package boundaries.
  const form = typedForm<AccountFormTypeInfo>(executionContext.getFormContext());

  // ─── Typed field access via the proxy ───────────────────────────────

  // Each property is the exact Attribute type, with IDE autocomplete and
  // dual-language label hovers (from the generated Fields enum).
  const name = form.name.getValue();                       // string | null            (StringAttribute)
  const creditLimit = form.creditlimit.getValue();         // number | null            (NumberAttribute)
  const onHold = form.creditonhold.getValue();             // boolean | null           (BooleanAttribute)
  const primaryContact = form.primarycontactid.getValue(); // Xrm.LookupValue[] | null (LookupAttribute)

  // COMPILE ERROR: "nonexistent" is not a field on AccountForm
  // form.nonexistent.getValue();
  // COMPILE ERROR: number is not assignable to string | null
  // form.name.setValue(123);

  // ─── Business logic with full type safety ───────────────────────────

  // Lock the credit limit field when the account is on hold or over a threshold.
  if (onHold === true || (creditLimit !== null && creditLimit > 1_000_000)) {
    // form.controls.creditlimit is typed as NumberControl - no cast needed.
    form.controls.creditlimit.setDisabled(true);
  }

  // A typed lookup is just LookupValue[] - no GUID string-munging needed.
  if (primaryContact && primaryContact.length > 0) {
    form.controls.primarycontactid.setVisible(true); // LookupControl
  }

  // ─── Typed controls ─────────────────────────────────────────────────

  form.controls.name.setVisible(name !== null); // StringControl

  // ─── Escape hatches ─────────────────────────────────────────────────

  // form.$context exposes the underlying FormContext (ui, data, tabs, ...).
  // For a field NOT on this form, use form.$unsafe(EntityFields.X) (nullable).
}
