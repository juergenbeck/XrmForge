import { describe, it, expect } from 'vitest';
import { MockAttribute } from '../src/mock-attribute.js';

describe('MockAttribute', () => {
  it('should store and return the name', () => {
    const attr = new MockAttribute('revenue');
    expect(attr.getName()).toBe('revenue');
  });

  it('should store and return the initial value', () => {
    const attr = new MockAttribute('revenue', 150000);
    expect(attr.getValue()).toBe(150000);
  });

  it('should default to null when no value provided', () => {
    const attr = new MockAttribute('revenue');
    expect(attr.getValue()).toBeNull();
  });

  it('should update value via setValue', () => {
    const attr = new MockAttribute('name', 'Contoso');
    attr.setValue('Fabrikam');
    expect(attr.getValue()).toBe('Fabrikam');
  });

  it('should track dirty state', () => {
    const attr = new MockAttribute('name', 'Contoso');
    expect(attr.getIsDirty()).toBe(false);
    attr.setValue('Fabrikam');
    expect(attr.getIsDirty()).toBe(true);
  });

  it('should not be dirty when setValue matches initial value', () => {
    const attr = new MockAttribute('name', 'Contoso');
    attr.setValue('Fabrikam');
    attr.setValue('Contoso');
    expect(attr.getIsDirty()).toBe(false);
  });

  it('should default required level to none', () => {
    const attr = new MockAttribute('name');
    expect(attr.getRequiredLevel()).toBe('none');
  });

  it('should update required level', () => {
    const attr = new MockAttribute('name');
    attr.setRequiredLevel('required');
    expect(attr.getRequiredLevel()).toBe('required');
  });

  it('should default submit mode to dirty', () => {
    const attr = new MockAttribute('name');
    expect(attr.getSubmitMode()).toBe('dirty');
  });

  it('should update submit mode', () => {
    const attr = new MockAttribute('name');
    attr.setSubmitMode('always');
    expect(attr.getSubmitMode()).toBe('always');
  });

  it('should register and track onChange handlers', () => {
    const attr = new MockAttribute('name');
    const handler = () => {};
    attr.addOnChange(handler);
    expect(attr.getOnChangeHandlers()).toHaveLength(1);
  });

  it('should remove onChange handlers', () => {
    const attr = new MockAttribute('name');
    const handler = () => {};
    attr.addOnChange(handler);
    attr.removeOnChange(handler);
    expect(attr.getOnChangeHandlers()).toHaveLength(0);
  });
});
