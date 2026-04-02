/**
 * @xrmforge/testing - Core Types
 *
 * Type definitions for the form mock builder.
 */

import type { MockAttribute } from './mock-attribute.js';
import type { MockControl } from './mock-control.js';
import type { MockUi } from './mock-ui.js';

/** Options for createFormMock */
export interface CreateFormMockOptions {
  /** Entity record ID (default: null GUID) */
  entityId?: string;
  /** Entity logical name (default: 'unknown') */
  entityName?: string;
}

/**
 * Return type of createFormMock. Provides both the typed formContext
 * and test-friendly accessors for assertions.
 */
export interface FormMock<TForm> {
  /** Mock FormContext, typed as the generated form interface */
  formContext: TForm;

  /** Shorthand: getAttribute(name).getValue() */
  getValue(name: string): unknown;

  /** Shorthand: getAttribute(name).setValue(value) */
  setValue(name: string, value: unknown): void;

  /** Direct access to MockAttribute for detailed assertions */
  getAttribute(name: string): MockAttribute;

  /** Direct access to MockControl for detailed assertions */
  getControl(name: string): MockControl;

  /** Access to MockUi for notification assertions */
  ui: MockUi;

  /** Create an Xrm.Events.EventContext (for onLoad handlers) */
  asEventContext(): Xrm.Events.EventContext;

  /** Create an Xrm.Events.EventContext with getEventSource (for onChange handlers) */
  asAttributeEventContext(fieldName: string): Xrm.Events.EventContext;

  /**
   * Fire all registered onChange handlers for a field.
   * Creates an EventContext with the attribute as event source and calls all handlers.
   */
  fireOnChange(fieldName: string): void;
}
