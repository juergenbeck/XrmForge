/**
 * @xrmforge/testing - MockControl
 *
 * Mock implementation of Xrm.Controls.StandardControl.
 * Tracks visibility, disabled state, label, and notifications.
 */

export class MockControl {
  private _name: string;
  private _visible: boolean = true;
  private _disabled: boolean = false;
  private _label: string = '';
  private _notifications: Map<string, string> = new Map();

  constructor(name: string) {
    this._name = name;
  }

  getName(): string {
    return this._name;
  }

  getVisible(): boolean {
    return this._visible;
  }

  setVisible(visible: boolean): void {
    this._visible = visible;
  }

  getDisabled(): boolean {
    return this._disabled;
  }

  setDisabled(disabled: boolean): void {
    this._disabled = disabled;
  }

  getLabel(): string {
    return this._label;
  }

  setLabel(label: string): void {
    this._label = label;
  }

  setNotification(message: string, uniqueId?: string): boolean {
    this._notifications.set(uniqueId ?? '_default', message);
    return true;
  }

  clearNotification(uniqueId?: string): boolean {
    this._notifications.delete(uniqueId ?? '_default');
    return true;
  }

  /** @internal Get all notifications (for assertions) */
  getNotifications(): ReadonlyMap<string, string> {
    return this._notifications;
  }

  getControlType(): string {
    return 'standard';
  }

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
