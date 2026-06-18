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

  it('should not crash when removing non-registered handler', () => {
    const attr = new MockAttribute('name');
    const handler = () => {};
    attr.removeOnChange(handler);
    expect(attr.getOnChangeHandlers()).toHaveLength(0);
  });

  it('should fire onChange handlers', () => {
    const attr = new MockAttribute('name', 'initial');
    let fired = false;
    attr.addOnChange(() => { fired = true; });
    attr.fireOnChange({} as Xrm.Events.EventContext);
    expect(fired).toBe(true);
  });

  it('should fire multiple onChange handlers in order', () => {
    const attr = new MockAttribute('name');
    const order: number[] = [];
    attr.addOnChange(() => order.push(1));
    attr.addOnChange(() => order.push(2));
    attr.fireOnChange({} as Xrm.Events.EventContext);
    expect(order).toEqual([1, 2]);
  });

  it('getAttributeType should return string', () => {
    const attr = new MockAttribute('name');
    expect(attr.getAttributeType()).toBe('string');
  });

  it('getFormat should return null', () => {
    const attr = new MockAttribute('name');
    expect(attr.getFormat()).toBeNull();
  });

  it('getText should default to empty and be seedable via setText', () => {
    const attr = new MockAttribute('markant_targetgroupcode', 1);
    expect(attr.getText()).toBe('');
    attr.setText('B2B');
    expect(attr.getText()).toBe('B2B');
  });

  it('getPrecision should default to 0 and be seedable via setPrecision', () => {
    const attr = new MockAttribute('amount', 12.5);
    expect(attr.getPrecision()).toBe(0);
    attr.setPrecision(2);
    expect(attr.getPrecision()).toBe(2);
  });

  it('getParent should return an object', () => {
    const attr = new MockAttribute('name');
    expect(attr.getParent()).toBeDefined();
  });

  it('getUserPrivilege should return full access', () => {
    const attr = new MockAttribute('name');
    const priv = attr.getUserPrivilege();
    expect(priv.canRead).toBe(true);
    expect(priv.canUpdate).toBe(true);
    expect(priv.canCreate).toBe(true);
  });

  it('controls collection should exist with zero length by default', () => {
    const attr = new MockAttribute('name');
    expect(attr.controls.getLength()).toBe(0);
  });

  it('controls.get() should return empty array when no controls', () => {
    const attr = new MockAttribute('name');
    const all = (attr.controls.get as () => unknown[])();
    expect(all).toEqual([]);
  });

  it('controls should be iterable via forEach after addControl', () => {
    const attr = new MockAttribute('name');
    const mockCtrl = { getName: () => 'name', setDisabled: () => {} } as unknown as Xrm.Controls.Control;
    attr.addControl(mockCtrl);
    expect(attr.controls.getLength()).toBe(1);

    const visited: Xrm.Controls.Control[] = [];
    attr.controls.forEach((ctrl) => visited.push(ctrl));
    expect(visited).toHaveLength(1);
    expect(visited[0]).toBe(mockCtrl);
  });

  it('controls.get() should return all controls as array', () => {
    const attr = new MockAttribute('name');
    const mockCtrl = { getName: () => 'name' } as unknown as Xrm.Controls.Control;
    attr.addControl(mockCtrl);
    const all = (attr.controls.get as () => unknown[])();
    expect(all).toHaveLength(1);
  });

  it('controls.get(index) should return control by index', () => {
    const attr = new MockAttribute('name');
    const mockCtrl = { getName: () => 'name' } as unknown as Xrm.Controls.Control;
    attr.addControl(mockCtrl);
    expect(attr.controls.get(0)).toBe(mockCtrl);
    expect(attr.controls.get(1)).toBeNull();
  });

  it('controls.get(name) should return control by name', () => {
    const attr = new MockAttribute('name');
    const mockCtrl = { getName: () => 'name' } as unknown as Xrm.Controls.Control;
    attr.addControl(mockCtrl);
    expect(attr.controls.get('name')).toBe(mockCtrl);
    expect(attr.controls.get('other')).toBeNull();
  });

  it('controls.get(chooser) should filter controls by predicate', () => {
    const attr = new MockAttribute('name');
    const ctrl1 = { getName: () => 'ctrl1' } as unknown as Xrm.Controls.Control;
    const ctrl2 = { getName: () => 'ctrl2' } as unknown as Xrm.Controls.Control;
    attr.addControl(ctrl1);
    attr.addControl(ctrl2);
    const result = attr.controls.get((c) => (c as { getName(): string }).getName() === 'ctrl2');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(ctrl2);
  });
});
