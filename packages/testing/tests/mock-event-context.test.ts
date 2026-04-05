import { describe, it, expect } from 'vitest';
import { MockEventContext } from '../src/mock-event-context.js';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createMinimalFormContext(): Xrm.FormContext {
  return {
    data: { entity: { getId: () => '{test-id}', getEntityName: () => 'account' } },
    ui: {},
    getAttribute: () => null,
    getControl: () => null,
  } as unknown as Xrm.FormContext;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MockEventContext', () => {
  it('should return the provided formContext via getFormContext', () => {
    const fc = createMinimalFormContext();
    const ctx = new MockEventContext(fc);

    expect(ctx.getFormContext()).toBe(fc);
  });

  it('should default eventSource to formContext when not provided', () => {
    const fc = createMinimalFormContext();
    const ctx = new MockEventContext(fc);

    expect(ctx.getEventSource()).toBe(fc);
  });

  it('should return explicit eventSource when provided', () => {
    const fc = createMinimalFormContext();
    const source = { getName: () => 'revenue' };
    const ctx = new MockEventContext(fc, source);

    expect(ctx.getEventSource()).toBe(source);
    expect((ctx.getEventSource() as any).getName()).toBe('revenue');
  });

  it('should return a GlobalContext stub from getContext', () => {
    const fc = createMinimalFormContext();
    const ctx = new MockEventContext(fc);

    const globalCtx = ctx.getContext();

    expect(globalCtx).toBeDefined();
    expect(globalCtx.getClientUrl()).toBe('https://org.crm4.dynamics.com');
    expect(globalCtx.getVersion()).toBe('9.2.0.0');
    expect(globalCtx.isOnPremises()).toBe(false);
    expect(globalCtx.getOrgUniqueName()).toBe('org');
  });

  it('should return client info from getContext', () => {
    const fc = createMinimalFormContext();
    const ctx = new MockEventContext(fc);

    const globalCtx = ctx.getContext();

    expect(globalCtx.client.getClient()).toBe('Web');
    expect(globalCtx.client.getClientState()).toBe('Online');
    expect(globalCtx.client.isOffline()).toBe(false);
  });

  it('should return userSettings from getContext', () => {
    const fc = createMinimalFormContext();
    const ctx = new MockEventContext(fc);

    const globalCtx = ctx.getContext();

    expect(globalCtx.userSettings.userName).toBe('Test User');
    expect(globalCtx.userSettings.languageId).toBe(1033);
  });

  it('should return depth of 1 from getDepth', () => {
    const fc = createMinimalFormContext();
    const ctx = new MockEventContext(fc);

    expect(ctx.getDepth()).toBe(1);
  });

  it('should return undefined for any shared variable', () => {
    const fc = createMinimalFormContext();
    const ctx = new MockEventContext(fc);

    expect(ctx.getSharedVariable('someKey')).toBeUndefined();
  });

  it('should not throw when setting a shared variable', () => {
    const fc = createMinimalFormContext();
    const ctx = new MockEventContext(fc);

    expect(() => ctx.setSharedVariable('key', 'value')).not.toThrow();
  });

  it('should work with null eventSource', () => {
    const fc = createMinimalFormContext();
    // Explicitly pass undefined (which triggers the ?? default)
    const ctx = new MockEventContext(fc, undefined);

    expect(ctx.getEventSource()).toBe(fc);
  });

  it('should preserve the exact formContext reference', () => {
    const fc = createMinimalFormContext();
    const ctx = new MockEventContext(fc);

    // Must be the same reference, not a copy
    expect(ctx.getFormContext()).toBe(fc);
    expect(ctx.getFormContext() === fc).toBe(true);
  });
});
