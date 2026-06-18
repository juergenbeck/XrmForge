/**
 * @xrmforge/testing - Core Types
 *
 * Type definitions for the form mock builder.
 */

import type { MockAttribute } from './mock-attribute.js';
import type { MockControl } from './mock-control.js';
import type { MockUi } from './mock-ui.js';

/** A section inside a seeded mock tab. */
export interface MockSectionConfig {
  /** Section name (as used by ui.tabs.get(tab).sections.get(name)). */
  name: string;
  /** Initial visibility (default: true). */
  visible?: boolean;
  /** Section label (default: the name). */
  label?: string;
}

/**
 * A tab to seed into the mock UI via createFormMock's `tabs` option.
 *
 * Seeding tabs makes `ui.tabs.get()` (no argument, all tabs), `forEach`, and
 * cross-tab section visibility testable. Sections track `setVisible`, so a test
 * can assert visibility after onLoad.
 */
export interface MockTabConfig {
  /** Tab name (as used by ui.tabs.get(name)). */
  name: string;
  /** Initial visibility (default: true). */
  visible?: boolean;
  /** Initial display state (default: 'expanded'). */
  displayState?: Xrm.DisplayState;
  /** Tab label (default: the name). */
  label?: string;
  /** Sections inside this tab (string shorthand = name with defaults). */
  sections?: Array<string | MockSectionConfig>;
}

/** Options for createFormMock */
export interface CreateFormMockOptions {
  /** Entity record ID (default: null GUID) */
  entityId?: string;
  /** Entity logical name (default: 'unknown') */
  entityName?: string;
  /**
   * Tab/section structure for ui.tabs. When omitted, tabs are fabricated
   * on demand by ui.tabs.get(name) (backwards compatible) and ui.tabs.get()
   * with no argument returns an empty array.
   */
  tabs?: MockTabConfig[];
  /**
   * Form type returned by formContext.ui.getFormType() (default 2 = Update).
   * Set to 1 to test Create-only paths (isFormType(ctx, FormType.Create)).
   */
  formType?: number;
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

  /**
   * Fire all entity onSave handlers (registered via
   * formContext.data.entity.addOnSave). Passes a save event context whose
   * getEventArgs().getSaveMode() returns the given mode and supports
   * preventDefault()/isDefaultPrevented() for testing save cancellation.
   *
   * @param saveMode - Numeric save mode (default 1 = Save; 70 = AutoSave)
   * @returns true if a handler called preventDefault(), otherwise false
   */
  fireOnSave(saveMode?: number): boolean;
}
