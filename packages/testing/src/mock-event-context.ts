/**
 * @xrmforge/testing - MockEventContext
 *
 * Mock implementation of Xrm.Events.EventContext.
 * Used for onLoad/onSave/onChange handler invocation.
 */

/**
 * Mock implementation of {@link Xrm.Events.EventContext} for unit testing.
 *
 * Provides access to the form context and event source, enabling
 * invocation of onLoad, onSave, and onChange handlers in tests.
 *
 * @example
 * ```typescript
 * const mock = createFormMock<AccountMainForm>({ name: 'Contoso' });
 * const eventCtx = mock.asEventContext();
 * onLoad(eventCtx);
 * ```
 */
export class MockEventContext {
  private _formContext: Xrm.FormContext;
  private _eventSource: unknown;

  /**
   * @param formContext - The mock form context to return from getFormContext()
   * @param eventSource - Optional event source (defaults to the form context)
   */
  constructor(formContext: Xrm.FormContext, eventSource?: unknown) {
    this._formContext = formContext;
    this._eventSource = eventSource ?? formContext;
  }

  /** Returns the mock form context. */
  getFormContext(): Xrm.FormContext {
    return this._formContext;
  }

  /** Returns the event source (the attribute for onChange, the form context for onLoad). */
  getEventSource(): unknown {
    return this._eventSource;
  }

  /** Returns a minimal stub of the Xrm global context. */
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

  /** Returns the execution depth (always 1 in this mock). */
  getDepth(): number {
    return 1;
  }

  /**
   * Returns a shared variable value (always undefined in this mock).
   *
   * @param _key - Variable key name
   */
  getSharedVariable(_key: string): unknown {
    return undefined;
  }

  /**
   * Sets a shared variable (no-op in this mock).
   *
   * @param _key - Variable key name
   * @param _value - Variable value
   */
  setSharedVariable(_key: string, _value: unknown): void {
    // no-op
  }
}
