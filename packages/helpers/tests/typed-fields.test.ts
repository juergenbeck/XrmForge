import { describe, it, expect, vi } from 'vitest';
import { typedFields } from '../src/typed-form.js';

// ─── Mock FormContext (declares some fields, omits one to test nullability) ──

interface MockAttr {
  _value: unknown;
  getValue: () => unknown;
  setValue: (v: unknown) => void;
  setSubmitMode: (mode: string) => void;
  controls: unknown[];
  getName: () => string;
}

function createMockFormContext() {
  const mk = (name: string, value: unknown): MockAttr => ({
    _value: value,
    getValue() {
      return this._value;
    },
    setValue(v) {
      this._value = v;
    },
    setSubmitMode: vi.fn(),
    controls: [],
    getName: () => name,
  });

  const attributes: Record<string, MockAttr> = {
    name: mk('name', 'Contoso'),
    revenue: mk('revenue', 150000),
    parentaccountid: mk('parentaccountid', null),
    statecode: mk('statecode', 0),
    // 'absent_field' is intentionally NOT here: declared in the kindMap, absent at runtime.
  };

  const controls: Record<string, { setDisabled: (v: boolean) => void; getDisabled: () => boolean }> = {
    name: (() => {
      let disabled = false;
      return {
        setDisabled(v: boolean) {
          disabled = v;
        },
        getDisabled() {
          return disabled;
        },
      };
    })(),
    // 'revenue' has no control -> getControl returns null.
  };

  return {
    getAttribute: (n?: string | number) => (typeof n === 'string' ? attributes[n] ?? null : null),
    getControl: (n?: string | number) => (typeof n === 'string' ? controls[n] ?? null : null),
    data: { entity: { getEntityName: () => 'account', getId: () => '{abc-123}' } },
    ui: { setFormNotification: vi.fn() },
  } as unknown as Xrm.FormContext;
}

const KIND_MAP = {
  name: 'string',
  revenue: 'number',
  parentaccountid: 'lookup',
  statecode: 'optionset',
  absent_field: 'number',
} as const;

// ─── Value access ────────────────────────────────────────────────────────────

describe('typedFields - value access', () => {
  it('reads a present field value', () => {
    const fc = createMockFormContext();
    const f = typedFields(fc, KIND_MAP);

    expect(f.name?.getValue()).toBe('Contoso');
    expect(f.revenue?.getValue()).toBe(150000);
  });

  it('auto-submits on setValue (setSubmitMode "always")', () => {
    const fc = createMockFormContext();
    const f = typedFields(fc, KIND_MAP);

    f.revenue?.setValue(200000);
    expect(f.revenue?.getValue()).toBe(200000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock attribute exposes the spy
    expect((fc.getAttribute('revenue') as any).setSubmitMode).toHaveBeenCalledWith('always');
  });
});

// ─── Nullability: absent attribute vs. empty value ───────────────────────────

describe('typedFields - honest nullability', () => {
  it('distinguishes an absent field (null attribute) from a present-but-empty value', () => {
    const fc = createMockFormContext();
    const f = typedFields(fc, KIND_MAP);

    // Present but empty: the attribute exists, its value is null.
    expect(f.parentaccountid).not.toBeNull();
    expect(f.parentaccountid?.getValue()).toBeNull();

    // Absent on the current record: the attribute handle itself is null.
    expect(f.absent_field).toBeNull();
  });
});

// ─── Controls (nullable) ─────────────────────────────────────────────────────

describe('typedFields - controls', () => {
  it('exposes the primary control and disables it', () => {
    const fc = createMockFormContext();
    const f = typedFields(fc, KIND_MAP);

    const ctrl = f.controls.name;
    expect(ctrl).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock control exposes setDisabled/getDisabled
    (ctrl as any).setDisabled(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock control exposes setDisabled/getDisabled
    expect((ctrl as any).getDisabled()).toBe(true);
  });

  it('returns null for a field without a control', () => {
    const fc = createMockFormContext();
    const f = typedFields(fc, KIND_MAP);

    expect(f.controls.revenue).toBeNull();
  });
});

// ─── $context, $unsafe ───────────────────────────────────────────────────────

describe('typedFields - escape hatches', () => {
  it('provides $context for full FormContext access', () => {
    const fc = createMockFormContext();
    const f = typedFields(fc, KIND_MAP);

    expect(f.$context).toBe(fc);
    expect(f.$context.data.entity.getEntityName()).toBe('account');
  });

  it('provides $unsafe for undeclared fields (nullable)', () => {
    const fc = createMockFormContext();
    const f = typedFields(fc, KIND_MAP);

    expect(f.$unsafe('name')).not.toBeNull();
    expect(f.$unsafe('does_not_exist')).toBeNull();
  });
});

// ─── Traps ───────────────────────────────────────────────────────────────────

describe('typedFields - set trap', () => {
  it('throws on direct assignment', () => {
    const fc = createMockFormContext();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing the set trap
    const f = typedFields(fc, KIND_MAP) as any;

    expect(() => {
      f.name = 'direct';
    }).toThrow(TypeError);
    expect(() => {
      f.name = 'direct';
    }).toThrow('Call .setValue() on the field instead');
  });
});

describe('typedFields - has trap', () => {
  it('reflects presence of declared fields and reserved keys', () => {
    const fc = createMockFormContext();
    const f = typedFields(fc, KIND_MAP);

    expect('name' in f).toBe(true);
    expect('absent_field' in f).toBe(false);
    expect('$context' in f).toBe(true);
    expect('controls' in f).toBe(true);
  });
});
