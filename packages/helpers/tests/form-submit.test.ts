import { describe, it, expect, vi } from 'vitest';
import { clearAndSubmit, setUnsafeAndSubmit } from '../src/form-submit.js';

describe('clearAndSubmit', () => {
  it('clears the value and forces SubmitMode.Always', () => {
    const setValue = vi.fn();
    const setSubmitMode = vi.fn();

    clearAndSubmit({ setValue, setSubmitMode });

    expect(setValue).toHaveBeenCalledWith(null);
    expect(setSubmitMode).toHaveBeenCalledWith('always');
  });
});

describe('setUnsafeAndSubmit', () => {
  it('sets an off-form attribute, forces submit, and returns true', () => {
    const setValue = vi.fn();
    const setSubmitMode = vi.fn();
    const attr = { setValue, setSubmitMode } as unknown as Xrm.Attributes.Attribute;
    const $unsafe = vi.fn().mockReturnValue(attr);

    const result = setUnsafeAndSubmit({ $unsafe }, 'lm_offformfield', 42);

    expect(result).toBe(true);
    expect($unsafe).toHaveBeenCalledWith('lm_offformfield');
    expect(setValue).toHaveBeenCalledWith(42);
    expect(setSubmitMode).toHaveBeenCalledWith('always');
  });

  it('returns false and does nothing when the field is absent', () => {
    const $unsafe = vi.fn().mockReturnValue(null);

    const result = setUnsafeAndSubmit({ $unsafe }, 'missing', 1);

    expect(result).toBe(false);
    expect($unsafe).toHaveBeenCalledWith('missing');
  });
});
