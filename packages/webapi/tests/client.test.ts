import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retrieve, retrieveMultiple, create, update, remove } from '../src/client.js';
import { WebApiError } from '../src/error.js';
import { QueryBuilder } from '../src/query-builder.js';

// ─── Xrm Mock ─────────────────────────────────────────────────────────────

const mockXrm = {
  WebApi: {
    retrieveRecord: vi.fn(),
    retrieveMultipleRecords: vi.fn(),
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
  },
};

// Install global Xrm mock
(globalThis as Record<string, unknown>).Xrm = mockXrm;

beforeEach(() => {
  vi.resetAllMocks();
});

// ─── Input Validation ──────────────────────────────────────────────────────

describe('input validation', () => {
  it('retrieve should throw on empty entityName', async () => {
    await expect(retrieve('', 'some-id')).rejects.toThrow('entityName is required');
  });

  it('retrieve should throw on empty id', async () => {
    await expect(retrieve('account', '')).rejects.toThrow('id is required');
  });

  it('retrieveMultiple should throw on empty entityName', async () => {
    await expect(retrieveMultiple('')).rejects.toThrow('entityName is required');
  });

  it('create should throw on empty entityName', async () => {
    await expect(create('', { name: 'test' })).rejects.toThrow('entityName is required');
  });

  it('update should throw on empty entityName', async () => {
    await expect(update('', 'id', { name: 'test' })).rejects.toThrow('entityName is required');
  });

  it('update should throw on empty id', async () => {
    await expect(update('account', '', { name: 'test' })).rejects.toThrow('id is required');
  });

  it('remove should throw on empty entityName', async () => {
    await expect(remove('', 'id')).rejects.toThrow('entityName is required');
  });

  it('remove should throw on empty id', async () => {
    await expect(remove('account', '')).rejects.toThrow('id is required');
  });

  it('validation errors should be WebApiError instances', async () => {
    try {
      await retrieve('', 'id');
    } catch (e) {
      expect(e).toBeInstanceOf(WebApiError);
      expect((e as WebApiError).errorCode).toBe('InvalidArgument');
    }
  });
});

// ─── retrieve ──────────────────────────────────────────────────────────────

describe('retrieve', () => {
  it('should return typed record', async () => {
    const mockRecord = { accountid: '123', name: 'Contoso' };
    mockXrm.WebApi.retrieveRecord.mockResolvedValue(mockRecord);

    const result = await retrieve<{ name: string }>('account', '123');
    expect(result.name).toBe('Contoso');
    expect(mockXrm.WebApi.retrieveRecord).toHaveBeenCalledWith('account', '123', '');
  });

  it('should pass query string', async () => {
    mockXrm.WebApi.retrieveRecord.mockResolvedValue({ name: 'X' });

    await retrieve('account', '123', '?$select=name');
    expect(mockXrm.WebApi.retrieveRecord).toHaveBeenCalledWith('account', '123', '?$select=name');
  });

  it('should pass QueryBuilder', async () => {
    mockXrm.WebApi.retrieveRecord.mockResolvedValue({ name: 'X' });

    await retrieve('account', '123', new QueryBuilder().select('name'));
    expect(mockXrm.WebApi.retrieveRecord).toHaveBeenCalledWith('account', '123', '?$select=name');
  });

  it('should wrap Xrm errors as WebApiError', async () => {
    mockXrm.WebApi.retrieveRecord.mockRejectedValue({ message: 'Not Found', errorCode: 404 });

    await expect(retrieve('account', '123')).rejects.toThrow(WebApiError);
  });
});

// ─── retrieveMultiple ──────────────────────────────────────────────────────

describe('retrieveMultiple', () => {
  it('should return first page by default', async () => {
    mockXrm.WebApi.retrieveMultipleRecords.mockResolvedValue({
      entities: [{ name: 'A' }, { name: 'B' }],
      nextLink: 'next-page-url',
    });

    const result = await retrieveMultiple<{ name: string }>('account');
    expect(result).toHaveLength(2);
    expect(mockXrm.WebApi.retrieveMultipleRecords).toHaveBeenCalledTimes(1);
  });

  it('should follow nextLink when maxPages > 1', async () => {
    mockXrm.WebApi.retrieveMultipleRecords
      .mockResolvedValueOnce({ entities: [{ name: 'A' }], nextLink: 'page2' })
      .mockResolvedValueOnce({ entities: [{ name: 'B' }], nextLink: 'page3' })
      .mockResolvedValueOnce({ entities: [{ name: 'C' }], nextLink: undefined });

    const result = await retrieveMultiple<{ name: string }>('account', undefined, { maxPages: 5 });
    expect(result).toHaveLength(3);
    expect(mockXrm.WebApi.retrieveMultipleRecords).toHaveBeenCalledTimes(3);
  });

  it('should stop at maxPages limit', async () => {
    mockXrm.WebApi.retrieveMultipleRecords
      .mockResolvedValueOnce({ entities: [{ name: 'A' }], nextLink: 'page2' })
      .mockResolvedValueOnce({ entities: [{ name: 'B' }], nextLink: 'page3' });

    const result = await retrieveMultiple<{ name: string }>('account', undefined, { maxPages: 2 });
    expect(result).toHaveLength(2);
    expect(mockXrm.WebApi.retrieveMultipleRecords).toHaveBeenCalledTimes(2);
  });

  it('should handle empty result', async () => {
    mockXrm.WebApi.retrieveMultipleRecords.mockResolvedValue({
      entities: [],
      nextLink: undefined,
    });

    const result = await retrieveMultiple('account');
    expect(result).toHaveLength(0);
  });
});

// ─── create ────────────────────────────────────────────────────────────────

describe('create', () => {
  it('should return created record id', async () => {
    mockXrm.WebApi.createRecord.mockResolvedValue({ id: 'new-guid' });

    const id = await create('account', { name: 'Contoso' });
    expect(id).toBe('new-guid');
    expect(mockXrm.WebApi.createRecord).toHaveBeenCalledWith('account', { name: 'Contoso' });
  });

  it('should wrap errors', async () => {
    mockXrm.WebApi.createRecord.mockRejectedValue({ message: 'Duplicate' });
    await expect(create('account', { name: 'X' })).rejects.toThrow(WebApiError);
  });
});

// ─── update ────────────────────────────────────────────────────────────────

describe('update', () => {
  it('should call updateRecord', async () => {
    mockXrm.WebApi.updateRecord.mockResolvedValue(undefined);

    await update('account', '123', { name: 'NewName' });
    expect(mockXrm.WebApi.updateRecord).toHaveBeenCalledWith('account', '123', { name: 'NewName' });
  });

  it('should wrap errors', async () => {
    mockXrm.WebApi.updateRecord.mockRejectedValue({ message: 'Forbidden' });
    await expect(update('account', '123', {})).rejects.toThrow(WebApiError);
  });
});

// ─── remove ────────────────────────────────────────────────────────────────

describe('remove', () => {
  it('should call deleteRecord', async () => {
    mockXrm.WebApi.deleteRecord.mockResolvedValue(undefined);

    await remove('account', '123');
    expect(mockXrm.WebApi.deleteRecord).toHaveBeenCalledWith('account', '123');
  });

  it('should wrap errors', async () => {
    mockXrm.WebApi.deleteRecord.mockRejectedValue({ message: 'Not Found' });
    await expect(remove('account', '123')).rejects.toThrow(WebApiError);
  });
});
