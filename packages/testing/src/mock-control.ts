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
  private _options: Array<{ text: string; value: number }> = [];
  private _customViews: Array<{
    viewId: string;
    entityName: string;
    viewDisplayName: string;
    fetchXml: string;
    layoutXml: string;
    isDefault: boolean;
  }> = [];
  private _defaultView: string = '';
  private _filterXml: string | undefined;
  private _showTime: boolean = false;
  private _refreshCount: number = 0;
  private _contentWindow: Window = {} as Window;

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

  // --- OptionSet-specific methods ---

  /**
   * Adds an option to an OptionSet control (e.g. for dependent/filtered picklists).
   * The option is stored; `index` inserts at a position (appended if omitted).
   *
   * @param option - The option ({ text, value })
   * @param index - Optional insert position
   */
  addOption(option: { text: string; value: number }, index?: number): void {
    if (index === undefined) this._options.push(option);
    else this._options.splice(index, 0, option);
  }

  /**
   * Removes an option from an OptionSet control by value.
   *
   * @param value - The numeric value of the option to remove
   */
  removeOption(value: number): void {
    this._options = this._options.filter((o) => o.value !== value);
  }

  /** Removes all options from an OptionSet control. */
  clearOptions(): void {
    this._options = [];
  }

  /** Returns the current options of an OptionSet control. */
  getOptions(): Array<{ text: string; value: number }> {
    return this._options;
  }

  // --- Lookup view methods ---

  /**
   * Adds a custom view to a lookup control. The view is stored but not applied.
   *
   * @param viewId - GUID of the view
   * @param entityName - Entity logical name the view targets
   * @param viewDisplayName - Display name of the view
   * @param fetchXml - FetchXML defining the view
   * @param layoutXml - Layout XML defining the columns
   * @param isDefault - Whether this view is the default
   */
  addCustomView(
    viewId: string,
    entityName: string,
    viewDisplayName: string,
    fetchXml: string,
    layoutXml: string,
    isDefault: boolean,
  ): void {
    this._customViews.push({
      viewId,
      entityName,
      viewDisplayName,
      fetchXml,
      layoutXml,
      isDefault,
    });
  }

  /** @internal Returns all registered custom views (for assertions). */
  getCustomViews(): ReadonlyArray<{
    viewId: string;
    entityName: string;
    viewDisplayName: string;
    fetchXml: string;
    layoutXml: string;
    isDefault: boolean;
  }> {
    return this._customViews;
  }

  /**
   * Sets the default view of a lookup control.
   *
   * @param viewId - GUID of the view to make default
   */
  setDefaultView(viewId: string): void {
    this._defaultView = viewId;
  }

  /** Returns the default view id of a lookup control. */
  getDefaultView(): string {
    return this._defaultView;
  }

  // --- Subgrid-specific methods ---

  /**
   * Sets a FetchXML filter on a subgrid control.
   *
   * Note: `setFilterXml` is NOT in the public @types/xrm (AGENT.md pitfall) - consumer
   * code casts to call it. This mock provides it so subgrid-filter tests need no patch.
   *
   * @param xml - The FetchXML filter
   */
  setFilterXml(xml: string): void {
    this._filterXml = xml;
  }

  /** @internal Returns the FetchXML filter set via setFilterXml (for assertions). */
  getFilterXml(): string | undefined {
    return this._filterXml;
  }

  /**
   * Refreshes a subgrid control (no-op in the mock; counts calls for assertions).
   *
   * Note: `GridControl.refresh()` is NOT in the public @types/xrm (AGENT.md pitfall #6) -
   * consumer code casts to call it. This mock provides it so subgrid tests that call
   * `setFilterXml` + `refresh` need no patch (F-MK9-01: a missing `refresh` previously threw
   * an unhandled rejection in the test).
   */
  refresh(): void {
    this._refreshCount++;
  }

  /** @internal Returns how often refresh() was called (for assertions). */
  getRefreshCount(): number {
    return this._refreshCount;
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
   * Returns the mock content window for a WebResource or IFrame control.
   *
   * Defaults to an empty object, which does NOT carry the custom methods a
   * WebResource page exports (e.g. `setClientApiContext`, `getlm_bestellungid`).
   * Inject a stub that has them via {@link setContentWindow} for WebResource tests
   * (F-LMA10-06).
   *
   * @returns Promise resolving to the configured mock Window (empty by default)
   */
  getContentWindow(): Promise<Window> {
    return Promise.resolve(this._contentWindow);
  }

  /**
   * Sets the mock content window returned by {@link getContentWindow}.
   *
   * A WebResource page exposes custom methods on its content window (the functions
   * the form script calls after `getContentWindow()`); the default empty window
   * does not have them, which previously caused unhandled rejections in
   * WebResource init tests. Pass a plain object stub carrying those methods.
   *
   * @param win - The mock content window (a plain object stub is fine)
   */
  setContentWindow(win: Partial<Window> & Record<string, unknown>): void {
    this._contentWindow = win as Window;
  }
}
