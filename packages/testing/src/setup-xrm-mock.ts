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
 * All WebApi methods return resolved promises with empty results by default.
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
 * Allows overriding specific Xrm.WebApi methods to simulate
 * server responses in tests.
 */
export interface SetupXrmMockOptions {
  /** Override specific Xrm.WebApi methods */
  webApiOverrides?: Partial<{
    retrieveRecord: (entityType: string, id: string, options?: string) => Promise<Record<string, unknown>>;
    retrieveMultipleRecords: (entityType: string, options?: string) => Promise<{ entities: Record<string, unknown>[] }>;
    createRecord: (entityType: string, data: Record<string, unknown>) => Promise<{ id: string }>;
    updateRecord: (entityType: string, id: string, data: Record<string, unknown>) => Promise<{ id: string }>;
    deleteRecord: (entityType: string, id: string) => Promise<{ id: string }>;
  }>;
}

/**
 * Set up a global Xrm mock for testing form scripts that access Xrm.WebApi,
 * Xrm.Navigation, or Xrm.Utility.
 *
 * All WebApi methods return resolved promises with empty results by default.
 * Override specific methods via the options parameter.
 *
 * @param options - Optional overrides for Xrm.WebApi methods
 *
 * @example
 * ```typescript
 * beforeEach(() => setupXrmMock({
 *   webApiOverrides: {
 *     retrieveMultipleRecords: async () => ({ entities: [{ name: 'Test' }] }),
 *   },
 * }));
 * afterEach(() => teardownXrmMock());
 * ```
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
  };

  const navigation = {
    openAlertDialog: async () => ({}),
    openConfirmDialog: async () => ({ confirmed: false }),
    openForm: async () => ({ savedEntityReference: [] }),
    openFile: async () => undefined,
  };

  const utility = {
    showProgressIndicator: () => undefined,
    closeProgressIndicator: () => undefined,
    getGlobalContext: () => ({
      getClientUrl: () => 'https://test.crm4.dynamics.com',
      organizationSettings: { uniqueName: 'testorg' },
      userSettings: {
        userId: '{00000000-0000-0000-0000-000000000001}',
        userName: 'Test User',
        languageId: 1033,
      },
    }),
  };

  const xrmMock = {
    WebApi: webApi,
    Navigation: navigation,
    Utility: utility,
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
