import { describe, it, expect, afterEach } from 'vitest';
import { setupXrmMock, teardownXrmMock } from '../src/setup-xrm-mock.js';

// Clean up after every test to avoid leaking global state
afterEach(() => {
  teardownXrmMock();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('setupXrmMock', () => {
  it('should set a global Xrm object', () => {
    expect((globalThis as any).Xrm).toBeUndefined();

    setupXrmMock();

    expect((globalThis as any).Xrm).toBeDefined();
  });

  it('should provide Xrm.WebApi with default methods', () => {
    setupXrmMock();

    const xrm = (globalThis as any).Xrm;
    expect(xrm.WebApi).toBeDefined();
    expect(typeof xrm.WebApi.retrieveRecord).toBe('function');
    expect(typeof xrm.WebApi.retrieveMultipleRecords).toBe('function');
    expect(typeof xrm.WebApi.createRecord).toBe('function');
    expect(typeof xrm.WebApi.updateRecord).toBe('function');
    expect(typeof xrm.WebApi.deleteRecord).toBe('function');
  });

  it('should return empty results from default WebApi methods', async () => {
    setupXrmMock();

    const xrm = (globalThis as any).Xrm;
    const record = await xrm.WebApi.retrieveRecord('account', 'some-id');
    expect(record).toEqual({});

    const multi = await xrm.WebApi.retrieveMultipleRecords('account');
    expect(multi.entities).toEqual([]);

    const created = await xrm.WebApi.createRecord('account', {});
    expect(created.id).toBe('00000000-0000-0000-0000-000000000000');

    const updated = await xrm.WebApi.updateRecord('account', 'id', {});
    expect(updated.id).toBe('00000000-0000-0000-0000-000000000000');

    const deleted = await xrm.WebApi.deleteRecord('account', 'id');
    expect(deleted.id).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('should provide Xrm.Navigation with default methods', async () => {
    setupXrmMock();

    const xrm = (globalThis as any).Xrm;
    expect(xrm.Navigation).toBeDefined();

    const alert = await xrm.Navigation.openAlertDialog();
    expect(alert).toEqual({});

    const confirm = await xrm.Navigation.openConfirmDialog();
    expect(confirm.confirmed).toBe(false);

    const form = await xrm.Navigation.openForm();
    expect(form.savedEntityReference).toEqual([]);
  });

  it('should provide Xrm.Utility with default methods', () => {
    setupXrmMock();

    const xrm = (globalThis as any).Xrm;
    expect(xrm.Utility).toBeDefined();
    expect(() => xrm.Utility.showProgressIndicator()).not.toThrow();
    expect(() => xrm.Utility.closeProgressIndicator()).not.toThrow();

    const ctx = xrm.Utility.getGlobalContext();
    expect(ctx.getClientUrl()).toBe('https://test.crm4.dynamics.com');
  });

  it('should apply webApiOverrides for retrieveMultipleRecords', async () => {
    const testEntities = [{ name: 'Contoso' }, { name: 'Fabrikam' }];

    setupXrmMock({
      webApiOverrides: {
        retrieveMultipleRecords: async () => ({ entities: testEntities }),
      },
    });

    const xrm = (globalThis as any).Xrm;
    const result = await xrm.WebApi.retrieveMultipleRecords('account');
    expect(result.entities).toEqual(testEntities);
    expect(result.entities).toHaveLength(2);
  });

  it('should apply webApiOverrides for retrieveRecord', async () => {
    setupXrmMock({
      webApiOverrides: {
        retrieveRecord: async (_entity: string, id: string) => ({ accountid: id, name: 'Test' }),
      },
    });

    const xrm = (globalThis as any).Xrm;
    const result = await xrm.WebApi.retrieveRecord('account', 'abc-123');
    expect(result.accountid).toBe('abc-123');
    expect(result.name).toBe('Test');
  });

  it('should apply webApiOverrides for createRecord', async () => {
    setupXrmMock({
      webApiOverrides: {
        createRecord: async () => ({ id: 'new-record-id' }),
      },
    });

    const xrm = (globalThis as any).Xrm;
    const result = await xrm.WebApi.createRecord('account', { name: 'New' });
    expect(result.id).toBe('new-record-id');
  });

  it('should keep non-overridden WebApi methods as defaults', async () => {
    setupXrmMock({
      webApiOverrides: {
        retrieveRecord: async () => ({ custom: true }),
      },
    });

    const xrm = (globalThis as any).Xrm;

    // Overridden method returns custom result
    const custom = await xrm.WebApi.retrieveRecord('account', 'id');
    expect(custom).toEqual({ custom: true });

    // Non-overridden methods still return defaults
    const multi = await xrm.WebApi.retrieveMultipleRecords('account');
    expect(multi.entities).toEqual([]);
  });
});

describe('teardownXrmMock', () => {
  it('should remove the global Xrm object', () => {
    setupXrmMock();
    expect((globalThis as any).Xrm).toBeDefined();

    teardownXrmMock();
    expect((globalThis as any).Xrm).toBeUndefined();
  });

  it('should not throw when called without prior setup', () => {
    expect(() => teardownXrmMock()).not.toThrow();
  });

  it('should support multiple setup/teardown cycles', () => {
    // First cycle
    setupXrmMock();
    expect((globalThis as any).Xrm).toBeDefined();
    teardownXrmMock();
    expect((globalThis as any).Xrm).toBeUndefined();

    // Second cycle
    setupXrmMock();
    expect((globalThis as any).Xrm).toBeDefined();
    teardownXrmMock();
    expect((globalThis as any).Xrm).toBeUndefined();
  });

  it('should allow fresh overrides after teardown and re-setup', async () => {
    // First setup with override A
    setupXrmMock({
      webApiOverrides: {
        retrieveRecord: async () => ({ version: 'A' }),
      },
    });
    let result = await (globalThis as any).Xrm.WebApi.retrieveRecord('account', 'id');
    expect(result.version).toBe('A');

    teardownXrmMock();

    // Second setup with override B
    setupXrmMock({
      webApiOverrides: {
        retrieveRecord: async () => ({ version: 'B' }),
      },
    });
    result = await (globalThis as any).Xrm.WebApi.retrieveRecord('account', 'id');
    expect(result.version).toBe('B');
  });
});
