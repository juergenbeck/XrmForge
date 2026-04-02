/**
 * @xrmforge/testing - MockEventContext
 *
 * Mock implementation of Xrm.Events.EventContext.
 * Used for onLoad/onSave/onChange handler invocation.
 */

export class MockEventContext {
  private _formContext: Xrm.FormContext;
  private _eventSource: unknown;

  constructor(formContext: Xrm.FormContext, eventSource?: unknown) {
    this._formContext = formContext;
    this._eventSource = eventSource ?? formContext;
  }

  getFormContext(): Xrm.FormContext {
    return this._formContext;
  }

  getEventSource(): unknown {
    return this._eventSource;
  }

  getContext(): Xrm.GlobalContext {
    // Minimal stub; tests that need specific GlobalContext values
    // should mock them explicitly via Object.assign or similar.
    return {
      getClientUrl: () => 'https://org.crm4.dynamics.com',
      getCurrentAppUrl: () => 'https://org.crm4.dynamics.com',
      client: {
        getClient: () => 'Web',
        getClientState: () => 'Online',
        isOffline: () => false,
      },
      userSettings: {
        userId: '{00000000-0000-0000-0000-000000000000}',
        userName: 'Test User',
        languageId: 1033,
        securityRoles: [],
        roles: { forEach: () => {}, get: (() => null) as never, getLength: () => 0 },
        getTimeZoneOffsetMinutes: () => 0,
      },
      getVersion: () => '9.2.0.0',
      isOnPremises: () => false,
      getOrgUniqueName: () => 'org',
      getOrgLcid: () => 1033,
      getUserLcid: () => 1033,
    } as unknown as Xrm.GlobalContext;
  }

  getDepth(): number {
    return 1;
  }

  getSharedVariable(_key: string): unknown {
    return undefined;
  }

  setSharedVariable(_key: string, _value: unknown): void {
    // no-op
  }
}
