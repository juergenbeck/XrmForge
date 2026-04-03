import { describe, it, expect } from 'vitest';
import { MockUi } from '../src/mock-ui.js';

describe('MockUi', () => {
  it('should store form notifications', () => {
    const ui = new MockUi();
    ui.setFormNotification('Fehler aufgetreten', 'ERROR', 'err-1');
    const notification = ui.getFormNotification('err-1');
    expect(notification).toBeDefined();
    expect(notification!.message).toBe('Fehler aufgetreten');
    expect(notification!.level).toBe('ERROR');
  });

  it('should clear form notifications', () => {
    const ui = new MockUi();
    ui.setFormNotification('Warnung', 'WARNING', 'warn-1');
    ui.clearFormNotification('warn-1');
    expect(ui.getFormNotification('warn-1')).toBeUndefined();
  });

  it('should track multiple notifications', () => {
    const ui = new MockUi();
    ui.setFormNotification('Fehler', 'ERROR', 'err-1');
    ui.setFormNotification('Info', 'INFO', 'info-1');
    expect(ui.getFormNotifications().size).toBe(2);
  });

  it('should return a tab mock from tabs.get', () => {
    const ui = new MockUi();
    const tab = ui.tabs.get('SUMMARY_TAB');
    expect(tab.getName()).toBe('SUMMARY_TAB');
    expect(tab.getVisible()).toBe(true);
  });

  it('should return tab with display state and label', () => {
    const ui = new MockUi();
    const tab = ui.tabs.get('TAB1');
    expect(tab.getDisplayState()).toBe('expanded');
    expect(tab.getLabel()).toBe('TAB1');
    tab.setVisible();
    tab.setDisplayState();
    tab.setLabel();
    tab.setFocus();
    tab.addTabStateChange(() => {});
    tab.removeTabStateChange(() => {});
    expect(tab.getParent()).toBeDefined();
  });

  it('should return tab with sections collection', () => {
    const ui = new MockUi();
    const tab = ui.tabs.get('TAB1');
    const section = (tab.sections as any).get('SEC1');
    expect(section.getName()).toBe('SEC1');
    expect(section.getVisible()).toBe(true);
    expect(section.getLabel()).toBe('SEC1');
    section.setVisible();
    section.setLabel();
    expect(section.getParent()).toBeDefined();
    expect(section.controls.getLength()).toBe(0);
  });

  it('should return tab with controls collection', () => {
    const ui = new MockUi();
    const tab = ui.tabs.get('TAB1');
    expect(tab.controls.getLength()).toBe(0);
  });

  it('tabs.forEach and getLength should work', () => {
    const ui = new MockUi();
    ui.tabs.forEach();
    expect(ui.tabs.getLength()).toBe(0);
  });

  it('close should not throw', () => {
    const ui = new MockUi();
    expect(() => ui.close()).not.toThrow();
  });

  it('getFormType should return Update (2)', () => {
    const ui = new MockUi();
    expect(ui.getFormType()).toBe(2);
  });

  it('getViewPortHeight should return 800', () => {
    const ui = new MockUi();
    expect(ui.getViewPortHeight()).toBe(800);
  });

  it('getViewPortWidth should return 1200', () => {
    const ui = new MockUi();
    expect(ui.getViewPortWidth()).toBe(1200);
  });

  it('refreshRibbon should not throw', () => {
    const ui = new MockUi();
    expect(() => ui.refreshRibbon()).not.toThrow();
    expect(() => ui.refreshRibbon(true)).not.toThrow();
  });

  it('setFormEntityName should not throw', () => {
    const ui = new MockUi();
    expect(() => ui.setFormEntityName('account')).not.toThrow();
  });

  it('setFormNotification should return true', () => {
    const ui = new MockUi();
    expect(ui.setFormNotification('msg', 'INFO', 'id1')).toBe(true);
  });

  it('clearFormNotification should return true', () => {
    const ui = new MockUi();
    expect(ui.clearFormNotification('id1')).toBe(true);
  });
});
