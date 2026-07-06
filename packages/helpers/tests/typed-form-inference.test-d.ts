/**
 * Type-level tests for typedForm inference.
 * Checked by `tsc --noEmit -p tsconfig.test-d.json` (wired into the typecheck
 * script), NOT executed by vitest. If this compiles without errors, the type
 * inference is correct.
 *
 * Uses the generated FormTypeInfo shape (typegen >= 0.9.2): a bundle of
 * fields/attributes/controls/form. Passing the bare form interface instead makes
 * ExtractFields resolve to `never` across the package boundary (TS 5.9+) - the
 * exact reason typedForm takes the TypeInfo, not the form interface.
 */
import { typedForm } from '../src/typed-form.js';
import type { TypedForm } from '../src/typed-form.js';

// ─── Simulated typegen output (the FormTypeInfo shape) ───────────────────────

type AccountFormFields = 'name' | 'revenue' | 'parentaccountid' | 'statecode' | 'statuscode';

type AccountFormAttributeMap = {
  name: Xrm.Attributes.StringAttribute;
  revenue: Xrm.Attributes.NumberAttribute;
  parentaccountid: Xrm.Attributes.LookupAttribute;
  statecode: Xrm.Attributes.OptionSetAttribute;
  statuscode: Xrm.Attributes.OptionSetAttribute;
};

type AccountFormControlMap = {
  name: Xrm.Controls.StringControl;
  revenue: Xrm.Controls.NumberControl;
  parentaccountid: Xrm.Controls.LookupControl;
  statecode: Xrm.Controls.OptionSetControl;
  statuscode: Xrm.Controls.OptionSetControl;
};

interface AccountForm extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'> {
  getAttribute<K extends AccountFormFields>(name: K): AccountFormAttributeMap[K];
  getAttribute(index: number): Xrm.Attributes.Attribute;
  getAttribute(): Xrm.Attributes.Attribute[];
  getControl<K extends AccountFormFields>(name: K): AccountFormControlMap[K];
  getControl(index: number): Xrm.Controls.Control;
  getControl(): Xrm.Controls.Control[];
}

/** The generated FormTypeInfo: what typegen emits and typedForm consumes. */
interface AccountFormTypeInfo {
  fields: AccountFormFields;
  attributes: AccountFormAttributeMap;
  controls: AccountFormControlMap;
  form: AccountForm;
}

// ─── Type assertions ─────────────────────────────────────────────────────────

declare const fc: Xrm.FormContext;
const form = typedForm<AccountFormTypeInfo>(fc);

// These must compile WITHOUT errors and WITHOUT `as any`:
// Fields in the generated interface ARE on the form (non-nullable).
// Off-form fields require $unsafe() which IS nullable.

// String field: getValue returns string | null
const nameValue: string | null = form.name.getValue();

// Number field: getValue returns number | null
const revenueValue: number | null = form.revenue.getValue();

// Lookup field: getValue returns LookupValue[] | null
const lookupValue: Xrm.LookupValue[] | null = form.parentaccountid.getValue();

// OptionSet field: getValue returns number | null
const stateValue: number | null = form.statecode.getValue();

// setValue is available and typed (non-nullable, field is on the form)
form.name.setValue('Test');
form.revenue.setValue(42);

// $unsafe returns nullable (field may not be on the form)
const unsafeAttr: Xrm.Attributes.Attribute | null = form.$unsafe('off_form_field');

// $context provides full FormContext
const entityName: string = form.$context.data.entity.getEntityName();

// controls proxy provides typed control access
const ctrl: Xrm.Controls.StringControl = form.controls.name;
const lookupCtrl: Xrm.Controls.LookupControl = form.controls.parentaccountid;

// The proxy is assignable to the public TypedForm<T> type (return-type stability)
const explicit: TypedForm<AccountFormTypeInfo> = form;

// Suppress unused variable warnings
void nameValue;
void revenueValue;
void lookupValue;
void stateValue;
void unsafeAttr;
void entityName;
void ctrl;
void lookupCtrl;
void explicit;
