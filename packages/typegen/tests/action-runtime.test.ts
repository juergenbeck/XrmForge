import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createBoundAction,
  createUnboundAction,
  createBoundFunction,
  createUnboundFunction,
  executeRequest,
  executeMultiple,
  withProgress,
} from '../src/generators/action-runtime.js';
import type { ParameterMetaMap } from '../src/generators/action-runtime.js';

// ─── Xrm Mock ─────────────────────────────────────────────────────────────

const mockExecute = vi.fn();
const mockExecuteMultiple = vi.fn();

(globalThis as Record<string, unknown>).Xrm = {
  WebApi: {
    online: {
      execute: mockExecute,
      executeMultiple: mockExecuteMultiple,
    },
  },
  Utility: {
    showProgressIndicator: vi.fn(),
    closeProgressIndicator: vi.fn(),
  },
  Navigation: {
    openErrorDialog: vi.fn(),
  },
};

beforeEach(() => {
  vi.resetAllMocks();
});

function mockResponse(ok: boolean, status: number, body?: unknown): Response {
  return {
    ok,
    status,
    text: vi.fn().mockResolvedValue(body ? JSON.stringify(body) : ''),
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

// ─── executeRequest / executeMultiple ──────────────────────────────────────

describe('executeRequest', () => {
  it('should call Xrm.WebApi.online.execute', async () => {
    const resp = mockResponse(true, 200);
    mockExecute.mockResolvedValue(resp);

    const result = await executeRequest({ getMetadata: () => ({}) });
    expect(result).toBe(resp);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });
});

describe('executeMultiple', () => {
  it('should call Xrm.WebApi.online.executeMultiple', async () => {
    const responses = [mockResponse(true, 200)];
    mockExecuteMultiple.mockResolvedValue(responses);

    const result = await executeMultiple([{ getMetadata: () => ({}) }]);
    expect(result).toEqual(responses);
  });
});

// ─── createBoundAction ─────────────────────────────────────────────────────

describe('createBoundAction', () => {
  it('should create executor without params (204 no-content)', async () => {
    const resp = mockResponse(true, 204);
    mockExecute.mockResolvedValue(resp);

    const action = createBoundAction('markant_winquote', 'quote');
    const result = await action.execute('{abc-123}');
    expect(result).toBe(resp);
  });

  it('should parse JSON response for bound action with result type', async () => {
    const resp = mockResponse(true, 200, { IsValid: true });
    mockExecute.mockResolvedValue(resp);

    const action = createBoundAction<{ IsValid: boolean }>('markant_validate', 'quote');
    const result = await action.execute('id1');
    expect(result.IsValid).toBe(true);
  });

  it('should throw on non-ok response', async () => {
    const resp = mockResponse(false, 400, 'Bad Request');
    mockExecute.mockResolvedValue(resp);

    const action = createBoundAction('test_action', 'account');
    await expect(action.execute('id1')).rejects.toThrow();
  });

  it('should strip braces from recordId', async () => {
    mockExecute.mockResolvedValue(mockResponse(true, 204));

    const action = createBoundAction('test_action', 'account');
    await action.execute('{abc-123}');

    const request = mockExecute.mock.calls[0][0];
    expect(request.entity.id).toBe('abc-123');
    expect(request.entity.entityType).toBe('account');
  });

  it('should build correct metadata', async () => {
    mockExecute.mockResolvedValue(mockResponse(true, 204));

    const action = createBoundAction('test_action', 'account');
    await action.execute('id1');

    const request = mockExecute.mock.calls[0][0];
    const metadata = request.getMetadata();
    expect(metadata.operationName).toBe('test_action');
    expect(metadata.boundParameter).toBe('entity');
    expect(metadata.operationType).toBe(0); // Action
  });

  it('should create request object without executing', () => {
    const action = createBoundAction('test_action', 'account');
    const request = action.request('id1');
    expect(request.entity).toBeDefined();
    expect(request.getMetadata).toBeTypeOf('function');
  });

  it('should pass typed parameters', async () => {
    mockExecute.mockResolvedValue(mockResponse(true, 204));

    const paramMeta: ParameterMetaMap = {
      Amount: { typeName: 'Edm.Decimal', structuralProperty: 1 },
    };
    const action = createBoundAction<{ Amount: number }>('test_action', 'account', paramMeta);
    await action.execute('id1', { Amount: 100 });

    const request = mockExecute.mock.calls[0][0];
    expect(request.Amount).toBe(100);
    const metadata = request.getMetadata();
    expect(metadata.parameterTypes.Amount).toBeDefined();
  });

  it('should pass typed parameters with result', async () => {
    const resp = mockResponse(true, 200, { ClonedId: 'guid-123' });
    mockExecute.mockResolvedValue(resp);

    const paramMeta: ParameterMetaMap = {
      IncludeProducts: { typeName: 'Edm.Boolean', structuralProperty: 1 },
    };
    const action = createBoundAction<{ IncludeProducts: boolean }, { ClonedId: string }>(
      'markant_clone', 'quote', paramMeta,
    );
    const result = await action.execute('id1', { IncludeProducts: true });
    expect(result.ClonedId).toBe('guid-123');
  });
});

// ─── createUnboundAction ───────────────────────────────────────────────────

describe('createUnboundAction', () => {
  it('should create executor without params', async () => {
    const resp = mockResponse(true, 204);
    mockExecute.mockResolvedValue(resp);

    const action = createUnboundAction('markant_globalaction');
    const result = await action.execute();
    expect(result).toBe(resp);
  });

  it('should parse JSON response when not 204', async () => {
    const resp = mockResponse(true, 200, { IsValid: true });
    mockExecute.mockResolvedValue(resp);

    const paramMeta: ParameterMetaMap = {
      Input: { typeName: 'Edm.String', structuralProperty: 1 },
    };
    const action = createUnboundAction<{ Input: string }, { IsValid: boolean }>(
      'markant_validate', paramMeta,
    );
    const result = await action.execute({ Input: 'test' });
    expect(result.IsValid).toBe(true);
  });

  it('should throw on non-ok response', async () => {
    const resp = mockResponse(false, 400, 'Bad Request');
    mockExecute.mockResolvedValue(resp);

    const action = createUnboundAction('markant_fail');
    await expect(action.execute()).rejects.toThrow();
  });

  it('should build unbound request metadata', () => {
    const action = createUnboundAction('markant_test');
    const request = action.request();
    const metadata = (request.getMetadata as () => Record<string, unknown>)();
    expect(metadata.boundParameter).toBeNull();
    expect(metadata.operationType).toBe(0); // Action
  });
});

// ─── createBoundFunction ───────────────────────────────────────────────────

describe('createBoundFunction', () => {
  it('should execute and parse response', async () => {
    const resp = mockResponse(true, 200, { Value: 42 });
    mockExecute.mockResolvedValue(resp);

    const func = createBoundFunction<{ Value: number }>('test_func', 'account');
    const result = await func.execute('id1');
    expect(result.Value).toBe(42);
  });

  it('should throw on non-ok response', async () => {
    const resp = mockResponse(false, 404, 'Not Found');
    mockExecute.mockResolvedValue(resp);

    const func = createBoundFunction<{ Value: number }>('test_func', 'account');
    await expect(func.execute('id1')).rejects.toThrow();
  });

  it('should build request with Function operationType', () => {
    const func = createBoundFunction<{ Value: number }>('test_func', 'account');
    const request = func.request('id1');
    const metadata = (request.getMetadata as () => Record<string, unknown>)();
    expect(metadata.operationType).toBe(1); // Function
  });
});

// ─── createUnboundFunction ─────────────────────────────────────────────────

describe('createUnboundFunction', () => {
  it('should execute and parse response', async () => {
    const resp = mockResponse(true, 200, { UserId: 'guid' });
    mockExecute.mockResolvedValue(resp);

    const func = createUnboundFunction<{ UserId: string }>('WhoAmI');
    const result = await func.execute();
    expect(result.UserId).toBe('guid');
  });

  it('should throw on non-ok response', async () => {
    const resp = mockResponse(false, 500, 'Internal Error');
    mockExecute.mockResolvedValue(resp);

    const func = createUnboundFunction<unknown>('Failing');
    await expect(func.execute()).rejects.toThrow();
  });

  it('should build request without bound parameter', () => {
    const func = createUnboundFunction<unknown>('WhoAmI');
    const request = func.request();
    const metadata = (request.getMetadata as () => Record<string, unknown>)();
    expect(metadata.boundParameter).toBeNull();
    expect(metadata.operationType).toBe(1); // Function
  });
});

// ─── withProgress ──────────────────────────────────────────────────────────

describe('withProgress', () => {
  it('should show and close progress indicator', async () => {
    const result = await withProgress('Loading...', async () => 42);
    expect(result).toBe(42);
    expect((Xrm.Utility as any).showProgressIndicator).toHaveBeenCalledWith('Loading...');
    expect((Xrm.Utility as any).closeProgressIndicator).toHaveBeenCalled();
  });

  it('should show error dialog and rethrow on failure', async () => {
    const error = new Error('Test failure');
    await expect(
      withProgress('Loading...', async () => { throw error; }),
    ).rejects.toThrow('Test failure');

    expect((Xrm.Navigation as any).openErrorDialog).toHaveBeenCalled();
    expect((Xrm.Utility as any).closeProgressIndicator).toHaveBeenCalled();
  });

  it('should handle non-Error throws', async () => {
    await expect(
      withProgress('Loading...', async () => { throw 'string error'; }),
    ).rejects.toBe('string error');

    expect((Xrm.Navigation as any).openErrorDialog).toHaveBeenCalledWith({
      message: 'string error',
    });
  });
});
