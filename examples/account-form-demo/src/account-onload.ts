/**
 * Account Form - onLoad Event Handler
 *
 * BEFORE XrmForge (untyped):
 *   var name = formContext.getAttribute("name");          // Xrm.Attributes.Attribute (generic)
 *   name.setValue(123);                                    // No compile error, runtime crash!
 *   var unknown = formContext.getAttribute("typo_field");  // No compile error, runtime null!
 *
 * AFTER XrmForge (typed):
 *   const name = formContext.getAttribute("name");        // Xrm.Attributes.StringAttribute (specific)
 *   name.setValue(123);                                   // Compile error: number is not string!
 *   const unknown = formContext.getAttribute("typo_field"); // Still works (fallback signature)
 *
 * This file demonstrates the value of generated types for Dynamics 365 form scripting.
 */

/**
 * onLoad handler for the Account main form.
 * Registered in D365 form properties as: AccountForm.onLoad
 */
export function onLoad(executionContext: Xrm.Events.EventContext): void {
  // Cast to our generated form interface: full type safety from here
  const formContext = executionContext.getFormContext() as XrmForge.Forms.Account.AccountAccountForm;

  // String fields: TypeScript knows these return StringAttribute
  const name = formContext.getAttribute("name");
  const phone = formContext.getAttribute("telephone1");
  const website = formContext.getAttribute("websiteurl");

  // OptionSet fields: TypeScript knows these return OptionSetAttribute
  const industry = formContext.getAttribute("industrycode");
  const ownership = formContext.getAttribute("ownershipcode");

  // Lookup fields: TypeScript knows these return LookupAttribute
  const primaryContact = formContext.getAttribute("primarycontactid");
  const parentAccount = formContext.getAttribute("parentaccountid");

  // Boolean fields: TypeScript knows these return BooleanAttribute
  const creditHold = formContext.getAttribute("creditonhold");

  // Number fields: TypeScript knows these return NumberAttribute
  const creditLimit = formContext.getAttribute("creditlimit");

  // Date fields: TypeScript knows these return DateAttribute
  const lastCampaign = formContext.getAttribute("lastusedincampaign");

  // ─── Example: Lock fields based on credit hold ──────────────────────────

  if (creditHold.getValue() === true) {
    // TypeScript knows creditLimit is NumberAttribute, so setValue expects number
    creditLimit.controls.forEach((control) => {
      control.setDisabled(true);
    });

    // TypeScript knows name is StringAttribute, getValue() returns string | null
    const accountName = name.getValue();
    if (accountName) {
      console.log(`Account "${accountName}" is on credit hold`);
    }
  }

  // ─── Example: Set industry based on business logic ──────────────────────

  // TypeScript knows industry is OptionSetAttribute, setValue expects number | null
  // With generated enums, we can use named values instead of magic numbers:
  // industry.setValue(XrmForge.OptionSets.IndustryCode.Accounting);

  // ─── Example: Control visibility with typed controls ────────────────────

  const nameControl = formContext.getControl("name");
  // TypeScript knows this is StringControl (not generic Control)
  nameControl.setVisible(true);

  const industryControl = formContext.getControl("industrycode");
  // TypeScript knows this is OptionSetControl
  industryControl.setVisible(true);

  const contactControl = formContext.getControl("primarycontactid");
  // TypeScript knows this is LookupControl
  contactControl.setVisible(true);

  const creditLimitControl = formContext.getControl("creditlimit");
  // TypeScript knows this is NumberControl
  creditLimitControl.setVisible(true);
}

/**
 * onChange handler for the Credit Hold field.
 * Registered on the creditonhold attribute.
 */
export function onCreditHoldChange(executionContext: Xrm.Events.EventContext): void {
  const formContext = executionContext.getFormContext() as XrmForge.Forms.Account.AccountAccountForm;

  const creditHold = formContext.getAttribute("creditonhold");
  const creditLimit = formContext.getAttribute("creditlimit");

  if (creditHold.getValue() === true) {
    // Lock the credit limit field
    creditLimit.controls.forEach((control) => {
      control.setDisabled(true);
    });
  } else {
    // Unlock the credit limit field
    creditLimit.controls.forEach((control) => {
      control.setDisabled(false);
    });
  }
}
