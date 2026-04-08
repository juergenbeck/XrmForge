/**
 * @xrmforge/testing - MockUi
 *
 * Mock implementation of Xrm.Ui.
 * Tracks form notifications for assertions.
 */

/**
 * Default values matching @xrmforge/helpers const enums.
 * Cannot import const enums across module boundaries with isolatedModules,
 * so we mirror the values here with semantic names.
 */
const DEFAULT_DISPLAY_STATE: Xrm.DisplayState = 'expanded'; // DisplayState.Expanded

/** Represents a form-level notification with message and severity level. */
export interface FormNotification {
  /** The notification message text. */
  message: string;
  /** The severity level ('INFO', 'WARNING', or 'ERROR'). */
  level: string;
}

/**
 * Mock implementation of {@link Xrm.Ui} for unit testing.
 *
 * Tracks form-level notifications and provides stub implementations
 * for tabs, close, and viewport methods.
 *
 * @example
 * ```typescript
 * const mock = createFormMock<AccountMainForm>({ name: 'Contoso' });
 * mock.ui.setFormNotification('Saved', 'INFO', 'save-ok');
 * expect(mock.ui.getFormNotification('save-ok')?.message).toBe('Saved');
 * ```
 */
export class MockUi {
  private _notifications: Map<string, FormNotification> = new Map();

  /**
   * Sets a form-level notification.
   *
   * @param message - Notification message text
   * @param level - Severity level ('INFO', 'WARNING', or 'ERROR')
   * @param uniqueId - Unique identifier for the notification
   * @returns Always true (success)
   */
  setFormNotification(message: string, level: string, uniqueId: string): boolean {
    this._notifications.set(uniqueId, { message, level });
    return true;
  }

  /**
   * Clears a form-level notification.
   *
   * @param uniqueId - Unique identifier of the notification to clear
   * @returns Always true (success)
   */
  clearFormNotification(uniqueId: string): boolean {
    this._notifications.delete(uniqueId);
    return true;
  }

  /** Get a specific notification by ID (for assertions) */
  getFormNotification(uniqueId: string): FormNotification | undefined {
    return this._notifications.get(uniqueId);
  }

  /** Get all notifications (for assertions) */
  getFormNotifications(): ReadonlyMap<string, FormNotification> {
    return this._notifications;
  }

  /** Stub: tabs.get returns a minimal Tab mock */
  tabs = {
    get: (name: string): Xrm.Controls.Tab =>
      ({
        getName: () => name,
        getVisible: () => true,
        setVisible: () => {},
        getDisplayState: () => DEFAULT_DISPLAY_STATE,
        setDisplayState: () => {},
        getLabel: () => name,
        setLabel: () => {},
        setFocus: () => {},
        addTabStateChange: () => {},
        removeTabStateChange: () => {},
        getParent: () => ({}) as Xrm.Ui,
        sections: {
          forEach: () => {},
          get: ((sectionName: string) => ({
            getName: () => sectionName,
            getVisible: () => true,
            setVisible: () => {},
            getLabel: () => sectionName,
            setLabel: () => {},
            getParent: () => ({}) as Xrm.Controls.Tab,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Xrm.Collection overloaded get()
            controls: { forEach: () => {}, get: (() => null) as any, getLength: () => 0 },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Xrm.Collection overloaded get()
          })) as any,
          getLength: () => 0,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Xrm.Collection overloaded get()
        controls: { forEach: () => {}, get: (() => null) as any, getLength: () => 0 },
      }) as unknown as Xrm.Controls.Tab,
    forEach: () => {},
    getLength: () => 0,
  };

  /** Closes the form (no-op in this mock). */
  close(): void {
    // no-op
  }

  /** Returns the form type (always 2 / Update in this mock). */
  getFormType(): XrmEnum.FormType {
    return 2 as XrmEnum.FormType; // XrmEnum.FormType.Update (const enum, cannot import with isolatedModules)
  }

  /** Returns the viewport height in pixels (always 800 in this mock). */
  getViewPortHeight(): number {
    return 800;
  }

  /** Returns the viewport width in pixels (always 1200 in this mock). */
  getViewPortWidth(): number {
    return 1200;
  }

  /**
   * Refreshes the command bar / ribbon (no-op in this mock).
   *
   * @param _refreshAll - Whether to refresh all ribbons
   */
  refreshRibbon(_refreshAll?: boolean): void {
    // no-op
  }

  /**
   * Sets the form entity name (no-op in this mock).
   *
   * @param _name - Entity name to set
   */
  setFormEntityName(_name: string): void {
    // no-op
  }
}
