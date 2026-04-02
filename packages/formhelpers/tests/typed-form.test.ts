import { describe, it, expect, vi } from 'vitest';
import { typedForm } from '../src/typed-form.js';
import type { TypedForm } from '../src/typed-form.js';

// ─── Test Form Types (simulate typegen output) ──────────────────────────────

type TestFields = 'name' | 'revenue' | 'parentaccountid';

type TestAttrMap = {
  name: Xrm.Attributes.StringAttribute;
  revenue: Xrm.Attributes.NumberAttribute;
  parentaccountid: Xrm.Attributes.LookupAttribute;
};

interface TestForm extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'> {
  getAttribute<K extends TestFields>(name: K): TestAttrMap[K];
  getAttribute(index: number): Xrm.Attributes.Attribute;
  getAttribute(): Xrm.Attributes.Attribute[];
  getControl<K extends TestFields>(name: K): Xrm.Controls.Control;
  getControl(index: number): Xrm.Controls.Control;
  getControl(): Xrm.Controls.Control[];
}

// ─── Mock FormContext ────────────────────────────────────────────────────────

function createMockFormContext() {
  const attributes: Record<string, { getValue: () => unknown; setValue: (v: unknown) => void; _value: unknown; getName: () => string }> = {
    name: { _value: 'Contoso', getValue() { return this._value; }, setValue(v) { this._value = v; }, getName: () => 'name' },
    revenue: { _value: 150000, getValue() { return this._value; }, setValue(v) { this._value = v; }, getName: () => 'revenue' },
    parentaccountid: { _value: null, getValue() { return this._value; }, setValue(v) { this._value = v; }, getName: () => 'parentaccountid' },
  };

  const controls: Record<string, { setDisabled: (v: boolean) => void; getDisabled: () => boolean; _disabled: boolean }> = {
    name: { _disabled: false, setDisabled(v) { this._disabled = v; }, getDisabled() { return this._disabled; } },
    revenue: { _disabled: false, setDisabled(v) { this._disabled = v; }, getDisabled() { return this._disabled; } },
  };

  return {
    getAttribute: (nameOrIndex?: string | number) => {
      if (typeof nameOrIndex === 'string') return attributes[nameOrIndex] ?? null;
      return null;
    },
    getControl: (nameOrIndex?: string | number) => {
      if (typeof nameOrIndex === 'string') return controls[nameOrIndex] ?? null;
      return null;
    },
    ui: {
      setFormNotification: vi.fn(),
      clearFormNotification: vi.fn(),
    },
    data: {
      entity: {
        getId: () => '{abc-123}',
        getEntityName: () => 'account',
      },
    },
  } as unknown as Xrm.FormContext;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('typedForm', () => {
  it('should access field value via property', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm, TestFields, TestAttrMap>(fc);

    expect((form.name as any).getValue()).toBe('Contoso');
  });

  it('should set field value via property', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm, TestFields, TestAttrMap>(fc);

    (form.name as any).setValue('Fabrikam');
    expect((form.name as any).getValue()).toBe('Fabrikam');
  });

  it('should access numeric field', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm, TestFields, TestAttrMap>(fc);

    expect((form.revenue as any).getValue()).toBe(150000);
  });

  it('should access lookup field', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm, TestFields, TestAttrMap>(fc);

    expect((form.parentaccountid as any).getValue()).toBeNull();
  });

  it('should provide $context for full FormContext access', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm, TestFields, TestAttrMap>(fc);

    expect(form.$context).toBe(fc);
    expect(form.$context.data.entity.getEntityName()).toBe('account');
  });

  it('should provide $control for control access', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm, TestFields, TestAttrMap>(fc);

    const ctrl = form.$control('name' as TestFields);
    expect(ctrl).toBeDefined();
  });

  it('should fall back to FormContext properties for non-field access', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm, TestFields, TestAttrMap>(fc);

    // data is a FormContext property, not a field
    expect((form as any).data).toBeDefined();
    expect((form as any).data.entity.getId()).toBe('{abc-123}');
  });

  it('should return falsy for unknown fields', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm, TestFields, TestAttrMap>(fc);

    // getAttribute returns null, fallback to FormContext property returns undefined
    expect((form as any).nonexistent_field).toBeFalsy();
  });
});

describe('typedForm with controls', () => {
  it('should disable a control via $control', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm, TestFields, TestAttrMap>(fc);

    const ctrl = form.$control('name' as TestFields) as any;
    ctrl.setDisabled(true);
    expect(ctrl.getDisabled()).toBe(true);
  });
});
