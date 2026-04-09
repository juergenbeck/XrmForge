/**
 * Type-level tests for typedForm inference.
 * This file is checked by tsc --noEmit but not executed by vitest.
 * If this compiles without errors, the type inference is correct.
 */
import { typedForm } from '../src/typed-form.js';
import type { TypedForm } from '../src/typed-form.js';

// ─── Simulated typegen output ────────────────────────────────────────────────

type AccountFields = 'name' | 'revenue' | 'parentaccountid' | 'statecode' | 'statuscode';

type AccountAttrMap = {
  name: Xrm.Attributes.StringAttribute;
  revenue: Xrm.Attributes.NumberAttribute;
  parentaccountid: Xrm.Attributes.LookupAttribute;
  statecode: Xrm.Attributes.OptionSetAttribute;
  statuscode: Xrm.Attributes.OptionSetAttribute;
};

type AccountCtrlMap = {
  name: Xrm.Controls.StringControl;
  revenue: Xrm.Controls.NumberControl;
  parentaccountid: Xrm.Controls.LookupControl;
  statecode: Xrm.Controls.OptionSetControl;
  statuscode: Xrm.Controls.OptionSetControl;
};

interface AccountForm extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'> {
  getAttribute<K extends AccountFields>(name: K): AccountAttrMap[K];
  getAttribute(index: number): Xrm.Attributes.Attribute;
  getAttribute(): Xrm.Attributes.Attribute[];
  getControl<K extends AccountFields>(name: K): AccountCtrlMap[K];
  getControl(index: number): Xrm.Controls.Control;
  getControl(): Xrm.Controls.Control[];
}

// ─── Type assertions ─────────────────────────────────────────────────────────

declare const fc: Xrm.FormContext;
const form = typedForm<AccountForm>(fc);

// These must compile WITHOUT errors and WITHOUT `as any`:
// All field accesses are nullable (field may not be on the form at runtime)

// String field: nullable attribute, getValue returns string | null
const nameValue: string | null | undefined = form.name?.getValue();

// Number field: nullable attribute
const revenueValue: number | null | undefined = form.revenue?.getValue();

// Lookup field: nullable attribute
const lookupValue: Xrm.LookupValue[] | null | undefined = form.parentaccountid?.getValue();

// OptionSet field: nullable attribute
const stateValue: number | null | undefined = form.statecode?.getValue();

// setValue requires optional chaining (field may not exist on form)
form.name?.setValue('Test');
form.revenue?.setValue(42);

// $context provides full FormContext
const _entityName: string = form.$context.data.entity.getEntityName();

// $control provides control access
const _ctrl: Xrm.Controls.Control = form.$control('name');

// Suppress unused variable warnings
void nameValue;
void revenueValue;
void lookupValue;
void stateValue;
void _entityName;
void _ctrl;
