/**
 * Example Form Script for Dynamics 365.
 *
 * Register in D365 as: {{namespace}}.Example.onLoad
 *
 * Replace this with your actual form logic.
 */

/**
 * Called when the form loads.
 */
export function onLoad(executionContext: Xrm.Events.EventContext): void {
  const formContext = executionContext.getFormContext();

  // Example: show a notification on the form
  formContext.ui.setFormNotification(
    'Form loaded successfully',
    'INFO',
    'example-notification',
  );

  // Example: read a field value
  const nameAttr = formContext.getAttribute('name');
  if (nameAttr) {
    const value = nameAttr.getValue();
    console.log('Name field value:', value);
  }
}

/**
 * Called when the form is saved.
 */
export function onSave(executionContext: Xrm.Events.EventContext): void {
  const formContext = executionContext.getFormContext();

  // Clear the notification on save
  formContext.ui.clearFormNotification('example-notification');
}
