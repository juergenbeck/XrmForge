/**
 * Example Form Script for Dynamics 365 using XrmForge best practices.
 *
 * Register in D365 as: {{namespace}}.Example.onLoad
 *
 * This template demonstrates the correct patterns:
 * - typedForm() for direct typed field access
 * - Fields Enum for addOnChange and $control
 * - Entity-level Fields for Web API select() queries
 * - wrapHandler for unified error handling
 * - Logger instead of console.log
 * - FormNotificationLevel constant instead of raw string
 * - pickLang() for localized UI strings
 *
 * Replace this file with your actual form logic after running 'xrmforge generate'.
 */
import { createLogger } from '../shared/logger.js';
import { wrapHandler } from '../shared/error-handler.js';
import { MESSAGES, pickLang } from '../shared/constants.js';
// For Web API queries and lookups also import: select, formLookupId
import { typedForm, FormNotificationLevel } from '@xrmforge/helpers';
// TODO: After 'xrmforge generate', replace with your actual imports:
// import type { ExampleForm } from '../../generated/forms/example.js';
// import { ExampleFormFieldsEnum as Fields } from '../../generated/forms/example.js';
// import { ExampleFields } from '../../generated/fields/example.js';
// import { EntityNames } from '../../generated/entity-names.js';

const logger = createLogger('{{namespace}}.Example');

/**
 * Called when the form loads.
 */
export const onLoad = wrapHandler('{{namespace}}.Example.onLoad', logger, async (ctx) => {
  // TODO: Replace 'Xrm.FormContext' with your generated form type:
  // const form = typedForm<ExampleForm>(ctx.getFormContext());
  const form = typedForm<Xrm.FormContext>(ctx.getFormContext());

  // Direct field access via typedForm proxy (fully typed):
  // const name = form.name.getValue();          // string | null
  // form.revenue.setValue(150000);               // NumberAttribute

  // addOnChange uses Fields Enum via $context:
  // form.$context.getAttribute(Fields.Name).addOnChange(() => {
  //   logger.debug('Name changed', { value: form.name.getValue() });
  // });

  // Web API queries use entity-level Fields:
  // const result = await Xrm.WebApi.retrieveRecord(
  //   EntityNames.Account, id,
  //   select(ExampleFields.Name, ExampleFields.WebsiteUrl)
  // );

  // Lookup access:
  // const parentId = formLookupId(form.parentaccountid);

  // Localized UI strings:
  const lang = pickLang(
    Xrm.Utility.getGlobalContext().userSettings.languageId,
    MESSAGES,
  );
  logger.info('Form loaded', { language: lang });

  // Form notifications use constants:
  form.$context.ui.setFormNotification(
    'Form loaded',
    FormNotificationLevel.Info,
    'example-load',
  );
});

/**
 * Called when the form is saved.
 */
export const onSave = wrapHandler('{{namespace}}.Example.onSave', logger, (ctx) => {
  const form = typedForm<Xrm.FormContext>(ctx.getFormContext());
  form.$context.ui.clearFormNotification('example-load');
});
