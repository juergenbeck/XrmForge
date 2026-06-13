import { describe, it, expect } from 'vitest';

/**
 * Example test for the form script.
 *
 * Uses @xrmforge/testing for type-safe mocking once you have
 * generated types. Replace with real form tests after 'xrmforge generate'.
 */
describe('{{namespace}}.Example', () => {
  it('should export onLoad handler', async () => {
    const mod = await import('../../src/forms/example-form.js');
    expect(typeof mod.onLoad).toBe('function');
  });

  it('should export onSave handler', async () => {
    const mod = await import('../../src/forms/example-form.js');
    expect(typeof mod.onSave).toBe('function');
  });

  // TODO: After running 'xrmforge generate', add real form tests.
  // createFormMock<TForm>() takes the generated FORM interface and returns a
  // FormMock: use mock.asEventContext() for the handler and mock.ui /
  // mock.getControl() for assertions (plain mocks, not vi.fn() spies).
  //
  // import { createFormMock } from '@xrmforge/testing';
  // import type { ExampleForm } from '../../generated/forms/example.js';
  //
  // it('should show notification on load', () => {
  //   const mock = createFormMock<ExampleForm>({ name: 'Contoso Ltd' });
  //   onLoad(mock.asEventContext());
  //   expect(mock.ui.getFormNotification('example-load')?.message).toBe('Form loaded');
  // });
});
