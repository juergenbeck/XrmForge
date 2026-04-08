import { describe, it, expect, vi } from 'vitest';

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

  // TODO: After running 'xrmforge generate', add real form tests:
  //
  // import { createFormMock } from '@xrmforge/testing';
  // import type { ExampleFormMockValues } from '../../generated/entities/Example.js';
  //
  // it('should show notification on load', () => {
  //   const { executionContext, formContext } = createFormMock<ExampleFormMockValues>({
  //     name: 'Contoso Ltd',
  //   });
  //   onLoad(executionContext);
  //   expect(formContext.ui.setFormNotification).toHaveBeenCalledWith(
  //     'Form loaded successfully', 'INFO', 'example-load-notification'
  //   );
  // });
});
