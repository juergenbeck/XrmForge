import { describe, it, expect } from 'vitest';
import { MockControl } from '../src/mock-control.js';

describe('MockControl', () => {
  it('should store and return the name', () => {
    const ctrl = new MockControl('revenue');
    expect(ctrl.getName()).toBe('revenue');
  });

  it('should default to visible', () => {
    const ctrl = new MockControl('revenue');
    expect(ctrl.getVisible()).toBe(true);
  });

  it('should toggle visibility', () => {
    const ctrl = new MockControl('revenue');
    ctrl.setVisible(false);
    expect(ctrl.getVisible()).toBe(false);
  });

  it('should default to not disabled', () => {
    const ctrl = new MockControl('revenue');
    expect(ctrl.getDisabled()).toBe(false);
  });

  it('should toggle disabled state', () => {
    const ctrl = new MockControl('revenue');
    ctrl.setDisabled(true);
    expect(ctrl.getDisabled()).toBe(true);
  });

  it('should update label', () => {
    const ctrl = new MockControl('revenue');
    ctrl.setLabel('Umsatz');
    expect(ctrl.getLabel()).toBe('Umsatz');
  });

  it('should store and clear notifications', () => {
    const ctrl = new MockControl('revenue');
    ctrl.setNotification('Pflichtfeld', 'warn-1');
    expect(ctrl.getNotifications().get('warn-1')).toBe('Pflichtfeld');
    ctrl.clearNotification('warn-1');
    expect(ctrl.getNotifications().size).toBe(0);
  });

  it('should use default uniqueId for notifications', () => {
    const ctrl = new MockControl('revenue');
    ctrl.setNotification('Fehler');
    expect(ctrl.getNotifications().get('_default')).toBe('Fehler');
    ctrl.clearNotification();
    expect(ctrl.getNotifications().size).toBe(0);
  });

  it('getControlType should return standard', () => {
    const ctrl = new MockControl('revenue');
    expect(ctrl.getControlType()).toBe('standard');
  });

  it('getParent should return an object', () => {
    const ctrl = new MockControl('revenue');
    expect(ctrl.getParent()).toBeDefined();
  });

  it('addPreSearch should not throw', () => {
    const ctrl = new MockControl('lookupfield');
    expect(() => ctrl.addPreSearch(() => {})).not.toThrow();
  });

  it('addCustomFilter should not throw', () => {
    const ctrl = new MockControl('lookupfield');
    expect(() => ctrl.addCustomFilter('<fetch/>', 'account')).not.toThrow();
  });
});
