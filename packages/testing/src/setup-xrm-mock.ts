/**
 * @xrmforge/testing - Global Xrm Mock Setup
 *
 * Sets up a minimal global Xrm object for testing form scripts that
 * call Xrm.WebApi, Xrm.Navigation, or Xrm.Utility.
 *
 * Usage in vitest setup or beforeEach:
 * ```typescript
 * import { setupXrmMock, teardownXrmMock } from '@xrmforge/testing';
 *
 * beforeEach(() => setupXrmMock());
 * afterEach(() => teardownXrmMock());
 * ```
 *
 * All methods are plain functions (not spies). To spy on a method, wrap it
 * with vi.fn() in your test or use webApiOverrides/navigationOverrides.
 *
 * Override specific methods in your test:
 * ```typescript
 * setupXrmMock({
 *   webApiOverrides: {
 *     retrieveMultipleRecords: async () => ({ entities: [{ name: 'Test' }] }),
 *   },
 * });
 * ```
 */

/**
 * Options for customizing the global Xrm mock.
 *
 * Allows overriding specific Xrm.WebApi, Xrm.Navigation, and Xrm.Utility methods
 * to simulate server responses and user interactions in tests.
 */
export interface SetupXrmMockOptions {
  /** Override specific Xrm.WebApi methods */
  webApiOverrides?: Partial<{
    retrieveRecord: (entityType: string, id: string, options?: string) => Promise<Record<string, unknown>>;
    retrieveMultipleRecords: (entityType: string, options?: string) => Promise<{ entities: Record<string, unknown>[] }>;
    createRecord: (entityType: string, data: Record<string, unknown>) => Promise<{ id: string }>;
    updateRecord: (entityType: string, id: string, data: Record<string, unknown>) => Promise<{ id: string }>;
    deleteRecord: (entityType: string, id: string) => Promise<{ id: string }>;
    /**
     * Override `Xrm.WebApi.online.execute`. The default returns a 204 (no body),
     * which makes Custom API executors that call `response.json()` throw - override
     * it with a JSON-bearing `Response` to test result-returning actions, e.g.
     * `execute: async () => new Response(JSON.stringify({ IsValid: true }), { status: 200 })`.
     */
    execute: (request: unknown) => Promise<Response>;
    /** Override `Xrm.WebApi.online.executeMultiple`. */
    executeMultiple: (requests: unknown[]) => Promise<Response[]>;
  }>;
  /** Override specific Xrm.Navigation methods */
  navigationOverrides?: Partial<{
    openAlertDialog: (...args: unknown[]) => Promise<unknown>;
    openConfirmDialog: (...args: unknown[]) => Promise<{ confirmed: boolean }>;
    openErrorDialog: (...args: unknown[]) => Promise<unknown>;
    openForm: (...args: unknown[]) => Promise<{ savedEntityReference: unknown[] }>;
  }>;
  /** Override specific Xrm.Utility.getGlobalContext() values */
  globalContextOverrides?: Partial<{
    clientUrl: string;
    languageId: number;
    userId: string;
    userName: string;
    securityRoles: Array<{ id: string; name?: string }>;
    /** Security roles exposed as the userSettings.roles ItemCollection (id/name/entityType). */
    roles: Xrm.LookupValue[];
  }>;
  /** Override specific Xrm.Utility methods */
  utilityOverrides?: Partial<{
    getEntityMetadata: (entityName: string, attributes?: string[]) => Promise<Record<string, unknown>>;
    lookupObjects: (lookupOptions: unknown) => Promise<Record<string, unknown>[]>;
  }>;
}

/**
 * Set up a global Xrm mock for testing form scripts that access Xrm.WebApi,
 * Xrm.Navigation, Xrm.Utility, or Xrm.App.
 *
 * Covers all commonly used Xrm APIs identified across 4 showcase sessions.
 *
 * @param options - Optional overrides for Xrm methods
 */
export function setupXrmMock(options?: SetupXrmMockOptions): void {
  const webApi = {
    retrieveRecord: options?.webApiOverrides?.retrieveRecord
      ?? (async () => ({})),
    retrieveMultipleRecords: options?.webApiOverrides?.retrieveMultipleRecords
      ?? (async () => ({ entities: [] })),
    createRecord: options?.webApiOverrides?.createRecord
      ?? (async () => ({ id: '00000000-0000-0000-0000-000000000000' })),
    updateRecord: options?.webApiOverrides?.updateRecord
      ?? (async () => ({ id: '00000000-0000-0000-0000-000000000000' })),
    deleteRecord: options?.webApiOverrides?.deleteRecord
      ?? (async () => ({ id: '00000000-0000-0000-0000-000000000000' })),
    online: {
      execute: options?.webApiOverrides?.execute
        ?? (async () => new Response(null, { status: 204 })),
      executeMultiple: options?.webApiOverrides?.executeMultiple
        ?? (async () => []),
    },
  };

  const navigation = {
    openAlertDialog: options?.navigationOverrides?.openAlertDialog
      ?? (async () => ({})),
    openConfirmDialog: options?.navigationOverrides?.openConfirmDialog
      ?? (async () => ({ confirmed: false })),
    openErrorDialog: options?.navigationOverrides?.openErrorDialog
      ?? (async () => ({})),
    openForm: options?.navigationOverrides?.openForm
      ?? (async () => ({ savedEntityReference: [] })),
    openFile: async () => undefined,
    openUrl: () => undefined,
    openWebResource: () => undefined,
  };

  const gcOverrides = options?.globalContextOverrides;

  // userSettings.roles is Collection.ItemCollection<LookupValue> in @types/xrm.
  // Seed it from globalContextOverrides.roles, or derive it from securityRoles.
  const roleItems: Xrm.LookupValue[] =
    gcOverrides?.roles
    ?? (gcOverrides?.securityRoles ?? []).map((r) => ({
      id: r.id,
      name: r.name ?? '',
      entityType: 'role',
    }));
  const roles = {
    get: ((selector?: number | ((item: Xrm.LookupValue, index: number) => boolean)) => {
      if (typeof selector === 'number') return roleItems[selector] ?? null;
      if (typeof selector === 'function') return roleItems.filter(selector);
      return [...roleItems];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Xrm.Collection overloaded get()
    }) as any,
    forEach: (callback: (item: Xrm.LookupValue, index: number) => void) => roleItems.forEach(callback),
    getLength: () => roleItems.length,
    // getAll is not part of @types/xrm but kept for backwards compatibility.
    getAll: () => [...roleItems],
  };

  const utility = {
    showProgressIndicator: () => undefined,
    closeProgressIndicator: () => undefined,
    getEntityMetadata: options?.utilityOverrides?.getEntityMetadata
      ?? (async () => ({ LogicalName: '', EntitySetName: '' })),
    lookupObjects: options?.utilityOverrides?.lookupObjects
      ?? (async () => []),
    getGlobalContext: () => ({
      getClientUrl: () => gcOverrides?.clientUrl ?? 'https://test.crm4.dynamics.com',
      getQueryStringParameters: () => ({}),
      organizationSettings: { uniqueName: 'testorg' },
      userSettings: {
        userId: gcOverrides?.userId ?? '{00000000-0000-0000-0000-000000000001}',
        userName: gcOverrides?.userName ?? 'Test User',
        languageId: gcOverrides?.languageId ?? 1033,
        securityRoles: gcOverrides?.securityRoles ?? [],
        roles,
      },
    }),
  };

  const app = {
    addGlobalNotification: async () => '1',
    clearGlobalNotification: async () => undefined,
  };

  const xrmMock = {
    WebApi: webApi,
    Navigation: navigation,
    Utility: utility,
    App: app,
  };

  (globalThis as Record<string, unknown>)['Xrm'] = xrmMock;
}

/**
 * Remove the global Xrm mock.
 * Call in afterEach() to clean up.
 */
export function teardownXrmMock(): void {
  delete (globalThis as Record<string, unknown>)['Xrm'];
}
