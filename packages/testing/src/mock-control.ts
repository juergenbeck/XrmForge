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
  private _entityTypes: string[] = [];
  private _preSearchHandlers: Array<() => void> = [];
  private _customFilters: Array<{ filter: string; entityLogicalName?: string }> =
    [];
  private _showTime: boolean = false;

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

  // --- Lookup-specific methods ---

  /**
   * Sets the entity types available for a lookup control.
   *
   * @param entityTypes - Array of entity logical names (e.g. ['account', 'contact'])
   */
  setEntityTypes(entityTypes: string[]): void {
    this._entityTypes = entityTypes;
  }

  /** Returns the entity types set on this lookup control. */
  getEntityTypes(): string[] {
    return this._entityTypes;
  }

  /**
   * Registers a pre-search handler on a lookup control.
   * The handler is stored but not executed.
   *
   * @param handler - Function to call before the lookup search dialog opens
   */
  addPreSearch(handler: () => void): void {
    this._preSearchHandlers.push(handler);
  }

  /** @internal Returns all registered pre-search handlers (for assertions). */
  getPreSearchHandlers(): ReadonlyArray<() => void> {
    return this._preSearchHandlers;
  }

  /**
   * Adds a custom FetchXML filter to a lookup control.
   * The filter is stored but not applied.
   *
   * @param filter - FetchXML filter string
   * @param entityLogicalName - Optional entity logical name to scope the filter
   */
  addCustomFilter(filter: string, entityLogicalName?: string): void {
    this._customFilters.push({ filter, entityLogicalName });
  }

  /** @internal Returns all registered custom filters (for assertions). */
  getCustomFilters(): ReadonlyArray<{
    filter: string;
    entityLogicalName?: string;
  }> {
    return this._customFilters;
  }

  // --- DateTime-specific methods ---

  /**
   * Sets whether the time component is shown on a DateTime control.
   *
   * @param showTime - true to show time, false to hide
   */
  setShowTime(showTime: boolean): void {
    this._showTime = showTime;
  }

  /** Returns whether the time component is shown. */
  getShowTime(): boolean {
    return this._showTime;
  }

  // --- WebResource/IFrame-specific methods ---

  /**
   * Returns a mock content window for a WebResource or IFrame control.
   *
   * @returns Promise resolving to an empty mock Window object
   */
  getContentWindow(): Promise<Window> {
    return Promise.resolve({} as Window);
  }
}
