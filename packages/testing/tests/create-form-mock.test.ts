import { describe, it, expect } from 'vitest';
import { createFormMock } from '../src/create-form-mock.js';
import type { TestAccountForm, TestAccountFormMockValues } from './helpers/test-form-types.js';

describe('createFormMock', () => {
  it('should create a mock with initial values', () => {
    const mock = createFormMock<TestAccountForm>({
      name: 'Contoso',
      revenue: 150000,
    } satisfies TestAccountFormMockValues);

    expect(mock.getValue('name')).toBe('Contoso');
    expect(mock.getValue('revenue')).toBe(150000);
  });

  it('should return null for fields not in initial values', () => {
    const mock = createFormMock<TestAccountForm>({
      name: 'Contoso',
    } satisfies TestAccountFormMockValues);

    expect(mock.getValue('revenue')).toBeNull();
  });

  it('should allow setValue after creation', () => {
    const mock = createFormMock<TestAccountForm>({
      name: 'Contoso',
    } satisfies TestAccountFormMockValues);

    mock.setValue('name', 'Fabrikam');
    expect(mock.getValue('name')).toBe('Fabrikam');
  });

  it('should provide typed formContext.getAttribute', () => {
    const mock = createFormMock<TestAccountForm>({
      name: 'Contoso',
      revenue: 150000,
    } satisfies TestAccountFormMockValues);

    const fc = mock.formContext;
    expect(fc.getAttribute('name').getValue()).toBe('Contoso');
    expect(fc.getAttribute('revenue').getValue()).toBe(150000);
  });

  it('should provide typed formContext.getControl', () => {
    const mock = createFormMock<TestAccountForm>({
      name: 'Contoso',
    } satisfies TestAccountFormMockValues);

    const fc = mock.formContext;
    const ctrl = fc.getControl('name');
    expect(ctrl.getVisible()).toBe(true);

    ctrl.setVisible(false);
    expect(ctrl.getVisible()).toBe(false);
  });

  it('should track control disabled state', () => {
    const mock = createFormMock<TestAccountForm>({
      name: 'Contoso',
    } satisfies TestAccountFormMockValues);

    mock.getControl('name').setDisabled(true);
    expect(mock.getControl('name').getDisabled()).toBe(true);
  });

  it('should provide entity metadata', () => {
    const mock = createFormMock<TestAccountForm>(
      { name: 'Contoso' } satisfies TestAccountFormMockValues,
      { entityId: 'abc-123', entityName: 'account' },
    );

    const fc = mock.formContext;
    expect(fc.data.entity.getId()).toBe('{abc-123}');
    expect(fc.data.entity.getEntityName()).toBe('account');
  });

  it('should track form notifications via ui', () => {
    const mock = createFormMock<TestAccountForm>({} satisfies TestAccountFormMockValues);

    const fc = mock.formContext;
    fc.ui.setFormNotification('Fehler', 'ERROR', 'err-1');

    expect(mock.ui.getFormNotifications().size).toBe(1);
    expect(mock.ui.getFormNotification('err-1')?.message).toBe('Fehler');
  });

  it('should create EventContext via asEventContext', () => {
    const mock = createFormMock<TestAccountForm>({
      name: 'Contoso',
    } satisfies TestAccountFormMockValues);

    const ctx = mock.asEventContext();
    const fc = ctx.getFormContext() as TestAccountForm;
    expect(fc.getAttribute('name').getValue()).toBe('Contoso');
  });

  it('should create attribute EventContext via asAttributeEventContext', () => {
    const mock = createFormMock<TestAccountForm>({
      name: 'Contoso',
    } satisfies TestAccountFormMockValues);

    const ctx = mock.asAttributeEventContext('name');
    expect(ctx.getEventSource()).toBeDefined();
    expect((ctx.getEventSource() as any).getName()).toBe('name');
  });

  it('should work with empty values', () => {
    const mock = createFormMock<TestAccountForm>();
    expect(mock.getValue('name')).toBeNull();
  });

  it('should support lookup values', () => {
    const lookupValue: Xrm.LookupValue[] = [
      { id: 'parent-123', entityType: 'account', name: 'Parent Corp' },
    ];

    const mock = createFormMock<TestAccountForm>({
      parentaccountid: lookupValue,
    } satisfies TestAccountFormMockValues);

    const val = mock.getValue('parentaccountid') as Xrm.LookupValue[];
    expect(val).toHaveLength(1);
    expect(val[0].name).toBe('Parent Corp');
  });

  it('should support boolean values', () => {
    const mock = createFormMock<TestAccountForm>({
      creditonhold: true,
    } satisfies TestAccountFormMockValues);

    expect(mock.getValue('creditonhold')).toBe(true);
  });

  it('should provide attribute required level via formContext', () => {
    const mock = createFormMock<TestAccountForm>({
      name: 'Contoso',
    } satisfies TestAccountFormMockValues);

    mock.getAttribute('name').setRequiredLevel('required');
    expect(mock.formContext.getAttribute('name').getRequiredLevel()).toBe('required');
  });

  it('should fire onChange handlers via fireOnChange', () => {
    const mock = createFormMock<TestAccountForm>({
      name: 'Contoso',
    } satisfies TestAccountFormMockValues);

    let handlerCalled = false;
    let receivedFormContext: unknown = null;
    let receivedEventSource: unknown = null;

    mock.getAttribute('name').addOnChange((ctx) => {
      handlerCalled = true;
      receivedFormContext = ctx.getFormContext();
      receivedEventSource = ctx.getEventSource();
    });

    mock.fireOnChange('name');

    expect(handlerCalled).toBe(true);
    expect(receivedFormContext).toBeDefined();
    expect((receivedEventSource as any).getName()).toBe('name');
  });

  it('should fire multiple onChange handlers in order', () => {
    const mock = createFormMock<TestAccountForm>({
      revenue: 100000,
    } satisfies TestAccountFormMockValues);

    const callOrder: number[] = [];
    mock.getAttribute('revenue').addOnChange(() => callOrder.push(1));
    mock.getAttribute('revenue').addOnChange(() => callOrder.push(2));

    mock.fireOnChange('revenue');

    expect(callOrder).toEqual([1, 2]);
  });

  it('should allow handler to read and modify other fields', () => {
    const mock = createFormMock<TestAccountForm>({
      revenue: 100000,
      creditonhold: false,
    } satisfies TestAccountFormMockValues);

    // Simuliere echte Geschäftslogik: wenn revenue > 50000, creditonhold = true
    mock.getAttribute('revenue').addOnChange((ctx) => {
      const fc = ctx.getFormContext() as TestAccountForm;
      const rev = fc.getAttribute('revenue').getValue() as number;
      if (rev > 50000) {
        fc.getAttribute('creditonhold').setValue(true);
      }
    });

    mock.fireOnChange('revenue');

    expect(mock.getValue('creditonhold')).toBe(true);
  });

  it('should not throw when firing onChange with no handlers', () => {
    const mock = createFormMock<TestAccountForm>({
      name: 'Contoso',
    } satisfies TestAccountFormMockValues);

    expect(() => mock.fireOnChange('name')).not.toThrow();
  });

  it('should link controls to attribute.controls collection', () => {
    const mock = createFormMock<TestAccountForm>({
      name: 'Contoso',
    } satisfies TestAccountFormMockValues);

    const attr = mock.getAttribute('name');
    expect(attr.controls.getLength()).toBe(1);

    // controls.get() without args should return array
    const allControls = (attr.controls.get as () => unknown[])();
    expect(allControls).toHaveLength(1);
  });

  it('should support attr.controls.forEach for disabling all controls', () => {
    const mock = createFormMock<TestAccountForm>({
      name: 'Contoso',
    } satisfies TestAccountFormMockValues);

    const attr = mock.getAttribute('name');
    attr.controls.forEach((ctrl) => {
      (ctrl as Xrm.Controls.StandardControl).setDisabled(true);
    });

    expect(mock.getControl('name').getDisabled()).toBe(true);
  });

  it('should link controls for lazy-initialized attributes', () => {
    const mock = createFormMock<TestAccountForm>({});

    // Access attribute not in initial values (lazy-init)
    const attr = mock.getAttribute('name');
    expect(attr.controls.getLength()).toBe(1);
  });

  it('should expose a seeded form type via options.formType', () => {
    const mock = createFormMock<TestAccountForm>(
      { name: 'Contoso' } satisfies TestAccountFormMockValues,
      { formType: 1 },
    );
    expect(mock.formContext.ui.getFormType()).toBe(1);
  });

  it('should default form type to Update (2)', () => {
    const mock = createFormMock<TestAccountForm>({ name: 'Contoso' });
    expect(mock.formContext.ui.getFormType()).toBe(2);
  });

  it('should fire entity onSave handlers via fireOnSave', () => {
    const mock = createFormMock<TestAccountForm>({ name: 'Contoso' });
    let savedMode = -1;
    mock.formContext.data.entity.addOnSave((ctx) => {
      savedMode = ctx.getEventArgs().getSaveMode();
    });
    const prevented = mock.fireOnSave(70);
    expect(savedMode).toBe(70);
    expect(prevented).toBe(false);
  });

  it('fireOnSave reports preventDefault from a handler', () => {
    const mock = createFormMock<TestAccountForm>({ name: 'Contoso' });
    mock.formContext.data.entity.addOnSave((ctx) => {
      ctx.getEventArgs().preventDefault();
    });
    expect(mock.fireOnSave()).toBe(true);
  });
});
