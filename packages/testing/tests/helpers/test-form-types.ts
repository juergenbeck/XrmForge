/**
 * Handcrafted form interfaces that simulate @xrmforge/typegen output.
 * Used for testing createFormMock without depending on typegen.
 */

// Simulates a generated Fields union type
type TestAccountFormFields = 'name' | 'revenue' | 'industrycode' | 'parentaccountid' | 'creditonhold';

// Simulates a generated AttributeMap
type TestAccountFormAttributeMap = {
  name: Xrm.Attributes.StringAttribute;
  revenue: Xrm.Attributes.NumberAttribute;
  industrycode: Xrm.Attributes.OptionSetAttribute;
  parentaccountid: Xrm.Attributes.LookupAttribute;
  creditonhold: Xrm.Attributes.BooleanAttribute;
};

// Simulates a generated ControlMap
type TestAccountFormControlMap = {
  name: Xrm.Controls.StringControl;
  revenue: Xrm.Controls.NumberControl;
  industrycode: Xrm.Controls.OptionSetControl;
  parentaccountid: Xrm.Controls.LookupControl;
  creditonhold: Xrm.Controls.StandardControl;
};

// Simulates a generated Form Interface
export interface TestAccountForm extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'> {
  getAttribute<K extends TestAccountFormFields>(name: K): TestAccountFormAttributeMap[K];
  getAttribute(index: number): Xrm.Attributes.Attribute;
  getAttribute(): Xrm.Attributes.Attribute[];

  getControl<K extends TestAccountFormFields>(name: K): TestAccountFormControlMap[K];
  getControl(index: number): Xrm.Controls.Control;
  getControl(): Xrm.Controls.Control[];
}

// Simulates a generated MockValues type
export type TestAccountFormMockValues = {
  name?: string | null;
  revenue?: number | null;
  industrycode?: number | null;
  parentaccountid?: Xrm.LookupValue[] | null;
  creditonhold?: boolean | null;
};
