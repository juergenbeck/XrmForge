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

  // --- Lookup-specific: setEntityTypes / getEntityTypes ---

  it('getEntityTypes should default to empty array', () => {
    const ctrl = new MockControl('primarycontactid');
    expect(ctrl.getEntityTypes()).toEqual([]);
  });

  it('setEntityTypes should store and return entity types', () => {
    const ctrl = new MockControl('primarycontactid');
    ctrl.setEntityTypes(['account', 'contact']);
    expect(ctrl.getEntityTypes()).toEqual(['account', 'contact']);
  });

  it('setEntityTypes should overwrite previous entity types', () => {
    const ctrl = new MockControl('primarycontactid');
    ctrl.setEntityTypes(['account']);
    ctrl.setEntityTypes(['contact', 'lead']);
    expect(ctrl.getEntityTypes()).toEqual(['contact', 'lead']);
  });

  // --- Lookup-specific: addPreSearch ---

  it('addPreSearch should store the handler', () => {
    const ctrl = new MockControl('primarycontactid');
    const handler = (): void => {};
    ctrl.addPreSearch(handler);
    expect(ctrl.getPreSearchHandlers()).toHaveLength(1);
    expect(ctrl.getPreSearchHandlers()[0]).toBe(handler);
  });

  it('addPreSearch should accumulate multiple handlers', () => {
    const ctrl = new MockControl('primarycontactid');
    ctrl.addPreSearch(() => {});
    ctrl.addPreSearch(() => {});
    ctrl.addPreSearch(() => {});
    expect(ctrl.getPreSearchHandlers()).toHaveLength(3);
  });

  // --- Lookup-specific: addCustomFilter ---

  it('addCustomFilter should store filter with entity name', () => {
    const ctrl = new MockControl('primarycontactid');
    ctrl.addCustomFilter('<filter type="and"><condition/></filter>', 'account');
    const filters = ctrl.getCustomFilters();
    expect(filters).toHaveLength(1);
    expect(filters[0].filter).toBe(
      '<filter type="and"><condition/></filter>',
    );
    expect(filters[0].entityLogicalName).toBe('account');
  });

  it('addCustomFilter should store filter without entity name', () => {
    const ctrl = new MockControl('primarycontactid');
    ctrl.addCustomFilter('<filter/>');
    const filters = ctrl.getCustomFilters();
    expect(filters).toHaveLength(1);
    expect(filters[0].filter).toBe('<filter/>');
    expect(filters[0].entityLogicalName).toBeUndefined();
  });

  it('addCustomFilter should accumulate multiple filters', () => {
    const ctrl = new MockControl('primarycontactid');
    ctrl.addCustomFilter('<filter>1</filter>', 'account');
    ctrl.addCustomFilter('<filter>2</filter>', 'contact');
    expect(ctrl.getCustomFilters()).toHaveLength(2);
  });

  // --- DateTime-specific: setShowTime / getShowTime ---

  it('getShowTime should default to false', () => {
    const ctrl = new MockControl('createdon');
    expect(ctrl.getShowTime()).toBe(false);
  });

  it('setShowTime should store the value', () => {
    const ctrl = new MockControl('createdon');
    ctrl.setShowTime(true);
    expect(ctrl.getShowTime()).toBe(true);
  });

  it('setShowTime should toggle back to false', () => {
    const ctrl = new MockControl('createdon');
    ctrl.setShowTime(true);
    ctrl.setShowTime(false);
    expect(ctrl.getShowTime()).toBe(false);
  });

  // --- WebResource/IFrame-specific: getContentWindow ---

  it('getContentWindow should return a Promise', () => {
    const ctrl = new MockControl('WebResource_script');
    const result = ctrl.getContentWindow();
    expect(result).toBeInstanceOf(Promise);
  });

  it('getContentWindow should resolve to a Window-like object', async () => {
    const ctrl = new MockControl('WebResource_script');
    const win = await ctrl.getContentWindow();
    expect(win).toBeDefined();
    expect(typeof win).toBe('object');
  });

  it('manages OptionSet options (add/remove/clear/get)', () => {
    const ctrl = new MockControl('lm_status');
    ctrl.addOption({ text: 'Open', value: 1 });
    ctrl.addOption({ text: 'Closed', value: 2 });
    ctrl.addOption({ text: 'Top', value: 0 }, 0);
    expect(ctrl.getOptions().map((o) => o.value)).toEqual([0, 1, 2]);

    ctrl.removeOption(1);
    expect(ctrl.getOptions().map((o) => o.value)).toEqual([0, 2]);

    ctrl.clearOptions();
    expect(ctrl.getOptions()).toEqual([]);
  });

  it('stores custom views and the default view (lookup control)', () => {
    const ctrl = new MockControl('primarycontactid');
    ctrl.addCustomView('view-1', 'contact', 'My View', '<fetch/>', '<grid/>', true);
    ctrl.setDefaultView('view-1');

    expect(ctrl.getCustomViews()).toHaveLength(1);
    expect(ctrl.getCustomViews()[0]!.viewDisplayName).toBe('My View');
    expect(ctrl.getDefaultView()).toBe('view-1');
  });

  it('stores a FetchXML filter (subgrid setFilterXml, not in @types/xrm)', () => {
    const ctrl = new MockControl('Subgrid_orders');
    ctrl.setFilterXml('<filter><condition/></filter>');
    expect(ctrl.getFilterXml()).toBe('<filter><condition/></filter>');
  });
});
