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
});
