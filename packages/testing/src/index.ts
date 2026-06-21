/**
 * @xrmforge/testing
 *
 * Type-safe testing utilities for Dynamics 365 form scripts.
 * Creates mock FormContext objects from generated XrmForge form interfaces.
 *
 * @packageDocumentation
 */

export { createFormMock } from './create-form-mock.js';
export { MockAttribute } from './mock-attribute.js';
export { MockControl } from './mock-control.js';
export { MockEntity } from './mock-entity.js';
export { MockUi } from './mock-ui.js';
export type { FormNotification } from './mock-ui.js';
export { MockEventContext } from './mock-event-context.js';
export type { CreateFormMockOptions, FormMock, MockTabConfig, MockSectionConfig } from './types.js';
export { setupXrmMock, teardownXrmMock } from './setup-xrm-mock.js';
export type { SetupXrmMockOptions, TrackedAppNotification } from './setup-xrm-mock.js';
