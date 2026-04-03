/**
 * @xrmforge/testing - MockUi
 *
 * Mock implementation of Xrm.Ui.
 * Tracks form notifications for assertions.
 */

export interface FormNotification {
  message: string;
  level: string;
}

export class MockUi {
  private _notifications: Map<string, FormNotification> = new Map();

  setFormNotification(message: string, level: string, uniqueId: string): boolean {
    this._notifications.set(uniqueId, { message, level });
    return true;
  }

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
        getDisplayState: () => 'expanded' as Xrm.DisplayState,
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

  close(): void {
    // no-op
  }

  getFormType(): XrmEnum.FormType {
    return 2 as XrmEnum.FormType; // Update
  }

  getViewPortHeight(): number {
    return 800;
  }

  getViewPortWidth(): number {
    return 1200;
  }

  refreshRibbon(_refreshAll?: boolean): void {
    // no-op
  }

  setFormEntityName(_name: string): void {
    // no-op
  }
}
