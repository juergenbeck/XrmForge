import { describe, it, expect } from 'vitest';

/**
 * Example test for the form script.
 *
 * Uses @xrmforge/testing for type-safe mocking once you have
 * generated types. For now, this is a placeholder.
 */
describe('{{namespace}}.Example', () => {
  it('should export onLoad function', async () => {
    const mod = await import('../../src/forms/example-form.js');
    expect(typeof mod.onLoad).toBe('function');
  });

  it('should export onSave function', async () => {
    const mod = await import('../../src/forms/example-form.js');
    expect(typeof mod.onSave).toBe('function');
  });
});
