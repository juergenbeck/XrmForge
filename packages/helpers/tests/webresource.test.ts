import { describe, it, expect, afterEach } from 'vitest';
import { parentXrm, getWebResourceContext } from '../src/webresource.js';

afterEach(() => {
  delete (globalThis as Record<string, unknown>).parent;
});

describe('parentXrm', () => {
  it('returns the Xrm object of the parent frame', () => {
    const xrm = { WebApi: {} };
    (globalThis as Record<string, unknown>).parent = { Xrm: xrm };

    expect(parentXrm()).toBe(xrm);
  });
});

describe('getWebResourceContext', () => {
  function setParentPageContext(input: unknown): void {
    (globalThis as Record<string, unknown>).parent = {
      Xrm: { Utility: { getPageContext: () => ({ input }) } },
    };
  }

  it('returns entityName and a brace-stripped entityId from the parent page context', () => {
    setParentPageContext({ entityName: 'account', entityId: '{8B5C9A10-0000-0000-0000-000000000001}' });

    expect(getWebResourceContext()).toEqual({
      entityName: 'account',
      entityId: '8B5C9A10-0000-0000-0000-000000000001',
    });
  });

  it('returns empty strings when the page context carries no entity record', () => {
    setParentPageContext({});

    expect(getWebResourceContext()).toEqual({ entityName: '', entityId: '' });
  });

  it('returns empty strings when the page input is null', () => {
    setParentPageContext(null);

    expect(getWebResourceContext()).toEqual({ entityName: '', entityId: '' });
  });
});
