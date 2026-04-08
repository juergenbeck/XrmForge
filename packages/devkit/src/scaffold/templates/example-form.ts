/**
 * Example Form Script for Dynamics 365 using XrmForge best practices.
 *
 * Register in D365 as: {{namespace}}.Example.onLoad
 *
 * This template demonstrates the correct patterns:
 * - Fields Enum for compile-time field validation
 * - Typed FormContext cast
 * - wrapHandler for unified error handling
 * - Logger instead of console.log
 * - FormNotificationLevel constant instead of raw string
 * - select() for Web API queries
 *
 * Replace this file with your actual form logic after running 'xrmforge generate'.
 */
import { createLogger } from '../shared/logger.js';
import { wrapHandler } from '../shared/error-handler.js';
import { FormNotificationLevel, select } from '@xrmforge/helpers';
// TODO: Import your generated types after running 'xrmforge generate'
// import type { ExampleForm } from '../../generated/entities/Example.js';
// import { ExampleFormFieldsEnum as Fields } from '../../generated/entities/Example.js';

const logger = createLogger('{{namespace}}.Example');

/**
 * Called when the form loads.
 */
export const onLoad = wrapHandler('{{namespace}}.Example.onLoad', logger, (executionContext) => {
  const form = executionContext.getFormContext();
  // TODO: Cast to your generated form type:
  // const form = executionContext.getFormContext() as ExampleForm;

  // Example: show a notification on the form
  form.ui.setFormNotification(
    'Form loaded successfully',
    FormNotificationLevel.Info,
    'example-load-notification',
  );

  // Example: read a field value using Fields Enum
  // const nameAttr = form.getAttribute(Fields.Name);
  // logger.debug('Name field value', { value: nameAttr.getValue() });

  // Example: Web API query with select()
  // const ref = formLookup(form.getAttribute(Fields.ParentAccountId));
  // if (ref) {
  //   const result = await Xrm.WebApi.retrieveRecord(
  //     EntityNames.Account, ref.id, select(AccountFields.Name, AccountFields.WebsiteUrl)
  //   );
  // }
});

/**
 * Called when the form is saved.
 */
export const onSave = wrapHandler('{{namespace}}.Example.onSave', logger, (executionContext) => {
  const form = executionContext.getFormContext();

  // Clear the load notification on save
  form.ui.clearFormNotification('example-load-notification');
});
