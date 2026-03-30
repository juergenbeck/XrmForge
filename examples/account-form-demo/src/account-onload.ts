/**
 * Account Form - onLoad Event Handler
 *
 * Demonstrates XrmForge compile-time safety:
 * - Fields enum with autocomplete and dual-language labels
 * - getAttribute returns exact type (StringAttribute, NumberAttribute, etc.)
 * - Unknown field names are compile errors (no fallback signature)
 * - select() helper for type-safe Web API queries
 */

// Type alias and Fields enum for convenience
type AccountForm = XrmForge.Forms.Account.AccountAccountForm;
import Fields = XrmForge.Forms.Account.AccountAccountFormFieldsEnum;

/**
 * onLoad handler for the Account main form.
 */
export function onLoad(executionContext: Xrm.Events.EventContext): void {
  const formContext = executionContext.getFormContext() as AccountForm;

  // ─── Typed field access via Fields enum ─────────────────────────────

  // Autocomplete shows: AccountName, Telephone1, Website, CreditLimit, ...
  // Hover shows: /** Account Name | Firmenname */
  const name = formContext.getAttribute(Fields.AccountName);
  // TypeScript knows: Xrm.Attributes.StringAttribute

  const phone = formContext.getAttribute(Fields.Telephone1);
  // TypeScript knows: Xrm.Attributes.StringAttribute

  const creditLimit = formContext.getAttribute(Fields.CreditLimit);
  // TypeScript knows: Xrm.Attributes.NumberAttribute

  const creditHold = formContext.getAttribute(Fields.CreditHold);
  // TypeScript knows: Xrm.Attributes.BooleanAttribute

  const primaryContact = formContext.getAttribute(Fields.PrimaryContact);
  // TypeScript knows: Xrm.Attributes.LookupAttribute

  const industry = formContext.getAttribute(Fields.ZzzNotusedIndustry);
  // TypeScript knows: Xrm.Attributes.OptionSetAttribute

  // ─── Compile errors for safety ──────────────────────────────────────

  // COMPILE ERROR: "nonexistent_field" is not in AccountAccountFormFields
  // formContext.getAttribute("nonexistent_field");

  // COMPILE ERROR: "typo_telephon1" is not in AccountAccountFormFields
  // formContext.getAttribute("typo_telephon1");

  // COMPILE ERROR: number is not assignable to string | null
  // name.setValue(123);

  // ─── Business logic with full type safety ───────────────────────────

  if (creditHold.getValue() === true) {
    // Lock the credit limit field
    const creditControl = formContext.getControl(Fields.CreditLimit);
    // TypeScript knows: Xrm.Controls.NumberControl
    creditControl.setDisabled(true);

    const accountName: string | null = name.getValue();
    if (accountName) {
      console.log(`Account "${accountName}" is on credit hold`);
    }
  }

  // ─── Typed controls ─────────────────────────────────────────────────

  const nameControl = formContext.getControl(Fields.AccountName);
  // TypeScript knows: Xrm.Controls.StringControl
  nameControl.setVisible(true);

  const contactControl = formContext.getControl(Fields.PrimaryContact);
  // TypeScript knows: Xrm.Controls.LookupControl
  contactControl.setVisible(true);

  // ─── Escape hatch for dynamic access ────────────────────────────────

  // If you need dynamic field access (rare), cast back to base FormContext:
  // const dynamic = (formContext as Xrm.FormContext).getAttribute(someVariable);
}
