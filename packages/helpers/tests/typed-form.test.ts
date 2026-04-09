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

type TestCtrlMap = {
  name: Xrm.Controls.StringControl;
  revenue: Xrm.Controls.NumberControl;
  parentaccountid: Xrm.Controls.LookupControl;
};

interface TestForm extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'> {
  getAttribute<K extends TestFields>(name: K): TestAttrMap[K];
  getAttribute(index: number): Xrm.Attributes.Attribute;
  getAttribute(): Xrm.Attributes.Attribute[];
  getControl<K extends TestFields>(name: K): TestCtrlMap[K];
  getControl(index: number): Xrm.Controls.Control;
  getControl(): Xrm.Controls.Control[];
}

// ─── Mock FormContext ────────────────────────────────────────────────────────

function createMockFormContext() {
  const attributes: Record<string, {
    getValue: () => unknown;
    setValue: (v: unknown) => void;
    getName: () => string;
    addOnChange: (handler: () => void) => void;
    _value: unknown;
  }> = {
    name: { _value: 'Contoso', getValue() { return this._value; }, setValue(v) { this._value = v; }, getName: () => 'name', addOnChange: vi.fn(), setSubmitMode: vi.fn() },
    revenue: { _value: 150000, getValue() { return this._value; }, setValue(v) { this._value = v; }, getName: () => 'revenue', addOnChange: vi.fn(), setSubmitMode: vi.fn() },
    parentaccountid: { _value: null, getValue() { return this._value; }, setValue(v) { this._value = v; }, getName: () => 'parentaccountid', addOnChange: vi.fn(), setSubmitMode: vi.fn() },
  };

  const controls: Record<string, {
    setDisabled: (v: boolean) => void;
    getDisabled: () => boolean;
    getName: () => string;
    _disabled: boolean;
  }> = {
    name: { _disabled: false, setDisabled(v) { this._disabled = v; }, getDisabled() { return this._disabled; }, getName: () => 'name' },
    revenue: { _disabled: false, setDisabled(v) { this._disabled = v; }, getDisabled() { return this._disabled; }, getName: () => 'revenue' },
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
      getFormType: () => 2,
    },
    data: {
      entity: {
        getId: () => '{abc-123}',
        getEntityName: () => 'account',
      },
    },
  } as unknown as Xrm.FormContext;
}

// ─── Type Inference Tests ────────────────────────────────────────────────────

describe('typedForm - type inference (single type parameter)', () => {
  it('should access string field value without cast', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm>(fc);

    // This is the key test: NO `as any` needed
    const value = form.name.getValue();
    expect(value).toBe('Contoso');
  });

  it('should set string field value without cast', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm>(fc);

    form.name.setValue('Fabrikam');
    expect(form.name.getValue()).toBe('Fabrikam');
  });

  it('should automatically call setSubmitMode after setValue', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm>(fc);

    form.name.setValue('Fabrikam');
    // setValue via typedForm proxy should auto-call setSubmitMode('always')
    expect(fc.getAttribute('name').setSubmitMode).toHaveBeenCalledWith('always');
  });

  it('should access numeric field without cast', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm>(fc);

    const value = form.revenue.getValue();
    expect(value).toBe(150000);
  });

  it('should access lookup field without cast', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm>(fc);

    const value = form.parentaccountid.getValue();
    expect(value).toBeNull();
  });

  it('should call addOnChange on attribute', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm>(fc);

    const handler = vi.fn();
    form.name.addOnChange(handler);
    expect(form.name.addOnChange).toBeDefined();
  });
});

// ─── $context and $control ───────────────────────────────────────────────────

describe('typedForm - $context', () => {
  it('should provide $context for full FormContext access', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm>(fc);

    expect(form.$context).toBe(fc);
    expect(form.$context.data.entity.getEntityName()).toBe('account');
  });

  it('should access ui via $context', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm>(fc);

    form.$context.ui.setFormNotification('test', 'INFO', 'test-id');
    expect(form.$context.ui.setFormNotification).toHaveBeenCalledWith('test', 'INFO', 'test-id');
  });
});

describe('typedForm - controls proxy', () => {
  it('should access control by field name via controls proxy', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm>(fc);

    const ctrl = form.controls.name;
    expect(ctrl).toBeDefined();
  });

  it('should disable a control via controls proxy', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm>(fc);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock control has setDisabled
    const ctrl = form.controls.name as any;
    ctrl.setDisabled(true);
    expect(ctrl.getDisabled()).toBe(true);
  });
});

// ─── Fallback and edge cases ─────────────────────────────────────────────────

describe('typedForm - fallback to FormContext', () => {
  it('should fall back to FormContext properties for non-field access', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm>(fc);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing fallback
    expect((form as any).data).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing fallback
    expect((form as any).data.entity.getId()).toBe('{abc-123}');
  });

  it('should return falsy for unknown fields', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm>(fc);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing unknown field
    expect((form as any).nonexistent_field).toBeFalsy();
  });
});

// ─── Set trap (prevents accidental assignment) ───────────────────────────────

describe('typedForm - set trap', () => {
  it('should throw TypeError on property assignment', () => {
    const fc = createMockFormContext();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing set trap
    const form = typedForm<TestForm>(fc) as any;

    expect(() => { form.name = 'direct'; }).toThrow(TypeError);
    expect(() => { form.name = 'direct'; }).toThrow('Use form.name.setValue() instead');
  });

  it('should throw TypeError on $context assignment', () => {
    const fc = createMockFormContext();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing set trap
    const form = typedForm<TestForm>(fc) as any;

    expect(() => { form.$context = null; }).toThrow(TypeError);
  });
});

// ─── Has trap (for `in` operator) ────────────────────────────────────────────

describe('typedForm - has trap', () => {
  it('should return true for existing fields', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm>(fc);

    expect('name' in form).toBe(true);
    expect('revenue' in form).toBe(true);
  });

  it('should return true for $context and $control', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm>(fc);

    expect('$context' in form).toBe(true);
    expect('controls' in form).toBe(true);
  });

  it('should return false for non-existing fields', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm>(fc);

    expect('nonexistent_field' in form).toBe(false);
  });

  it('should return false for symbol keys', () => {
    const fc = createMockFormContext();
    const form = typedForm<TestForm>(fc);

    expect(Symbol.toPrimitive in form).toBe(false);
  });
});

// ─── Symbol handling ─────────────────────────────────────────────────────────

describe('typedForm - symbol handling', () => {
  it('should handle Symbol.toPrimitive via get trap', () => {
    const fc = createMockFormContext();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing symbol access
    const form = typedForm<TestForm>(fc) as any;

    expect(() => form[Symbol.toPrimitive]).not.toThrow();
  });
});
