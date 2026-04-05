/**
 * @xrmforge/testing - MockControl
 *
 * Mock implementation of Xrm.Controls.StandardControl.
 * Tracks visibility, disabled state, label, and notifications.
 */

/**
 * Mock implementation of {@link Xrm.Controls.StandardControl} for unit testing.
 *
 * Tracks visibility, disabled state, label, and field-level notifications.
 * Instances are created automatically by {@link createFormMock}.
 *
 * @example
 * ```typescript
 * const mock = createFormMock<AccountMainForm>({ name: 'Contoso' });
 * const ctrl = mock.getControl('name');
 * ctrl.setVisible(false);
 * expect(ctrl.getVisible()).toBe(false);
 * ```
 */
export class MockControl {
  private _name: string;
  private _visible: boolean = true;
  private _disabled: boolean = false;
  private _label: string = '';
  private _notifications: Map<string, string> = new Map();

  /**
   * @param name - Logical name of the control (matches the attribute name)
   */
  constructor(name: string) {
    this._name = name;
  }

  /** Returns the logical name of the control. */
  getName(): string {
    return this._name;
  }

  /** Returns whether the control is currently visible. */
  getVisible(): boolean {
    return this._visible;
  }

  /**
   * Sets the visibility of the control.
   *
   * @param visible - true to show, false to hide
   */
  setVisible(visible: boolean): void {
    this._visible = visible;
  }

  /** Returns whether the control is currently disabled. */
  getDisabled(): boolean {
    return this._disabled;
  }

  /**
   * Sets the disabled state of the control.
   *
   * @param disabled - true to disable, false to enable
   */
  setDisabled(disabled: boolean): void {
    this._disabled = disabled;
  }

  /** Returns the label text of the control. */
  getLabel(): string {
    return this._label;
  }

  /**
   * Sets the label text of the control.
   *
   * @param label - The label text to display
   */
  setLabel(label: string): void {
    this._label = label;
  }

  /**
   * Sets a field-level notification on the control.
   *
   * @param message - Notification message text
   * @param uniqueId - Optional unique identifier for the notification
   * @returns Always true (success)
   */
  setNotification(message: string, uniqueId?: string): boolean {
    this._notifications.set(uniqueId ?? '_default', message);
    return true;
  }

  /**
   * Clears a field-level notification from the control.
   *
   * @param uniqueId - Optional unique identifier of the notification to clear
   * @returns Always true (success)
   */
  clearNotification(uniqueId?: string): boolean {
    this._notifications.delete(uniqueId ?? '_default');
    return true;
  }

  /** @internal Get all notifications (for assertions) */
  getNotifications(): ReadonlyMap<string, string> {
    return this._notifications;
  }

  /** Returns the control type string (always 'standard' in this mock). */
  getControlType(): string {
    return 'standard';
  }

  /** Returns a stub parent section reference. */
  getParent(): Xrm.Controls.Section {
    return {} as Xrm.Controls.Section;
  }

  /** Lookup-specific: addPreSearch (no-op for non-lookup controls) */
  addPreSearch(_handler: () => void): void {
    // no-op
  }

  /** Lookup-specific: addCustomFilter (no-op for non-lookup controls) */
  addCustomFilter(_filter: string, _entityLogicalName?: string): void {
    // no-op
  }
}
