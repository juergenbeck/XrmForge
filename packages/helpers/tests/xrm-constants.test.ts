import { describe, it, expect } from 'vitest';
import { FormType, isFormType } from '../src/xrm-constants.js';

/** Minimal FormContext whose getFormType() returns a fixed numeric form type. */
function formContextWithType(type: number): Xrm.FormContext {
  return { ui: { getFormType: () => type } } as unknown as Xrm.FormContext;
}

describe('isFormType', () => {
  it('matches the current form type', () => {
    expect(isFormType(formContextWithType(1), FormType.Create)).toBe(true);
    expect(isFormType(formContextWithType(2), FormType.Update)).toBe(true);
  });

  it('returns false for a different form type', () => {
    expect(isFormType(formContextWithType(2), FormType.Create)).toBe(false);
    expect(isFormType(formContextWithType(3), FormType.Create)).toBe(false);
  });
});
