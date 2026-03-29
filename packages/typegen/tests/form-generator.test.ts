import { describe, it, expect } from 'vitest';
import { generateFormInterface, generateEntityForms } from '../src/generators/form-generator.js';
import type { ParsedForm, AttributeMetadata } from '../src/metadata/types.js';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createAttr(logicalName: string, attributeType: string): AttributeMetadata {
  return {
    LogicalName: logicalName,
    SchemaName: logicalName.charAt(0).toUpperCase() + logicalName.slice(1),
    AttributeType: attributeType,
    DisplayName: { LocalizedLabels: [], UserLocalizedLabel: null },
    IsPrimaryId: false,
    IsPrimaryName: false,
    RequiredLevel: { Value: 'None' },
    IsValidForRead: true,
    IsValidForCreate: true,
    IsValidForUpdate: true,
    MetadataId: `attr-${logicalName}`,
  };
}

function createForm(name: string, fields: string[]): ParsedForm {
  return {
    name,
    formId: 'form-1',
    isDefault: true,
    tabs: [{
      name: 'General',
      sections: [{
        name: 'General',
        controls: fields.map((f) => ({ id: f, datafieldname: f, classid: '' })),
      }],
    }],
    allControls: fields.map((f) => ({ id: f, datafieldname: f, classid: '' })),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('generateFormInterface', () => {
  it('should generate a form interface extending Xrm.FormContext', () => {
    const form = createForm('Account', ['name', 'telephone1']);
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', createAttr('name', 'String')],
      ['telephone1', createAttr('telephone1', 'String')],
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    expect(result).toContain('declare namespace XrmForge.Forms.Account {');
    expect(result).toContain("interface AccountAccountForm extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'> {");
    expect(result).toContain('getAttribute(name: "name"): Xrm.Attributes.StringAttribute;');
    expect(result).toContain('getAttribute(name: "telephone1"): Xrm.Attributes.StringAttribute;');
  });

  it('should generate getControl overloads with correct types', () => {
    const form = createForm('Information', ['name', 'revenue', 'ownerid']);
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', createAttr('name', 'String')],
      ['revenue', createAttr('revenue', 'Money')],
      ['ownerid', createAttr('ownerid', 'Owner')],
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    expect(result).toContain('getControl(name: "name"): Xrm.Controls.StringControl;');
    expect(result).toContain('getControl(name: "revenue"): Xrm.Controls.NumberControl;');
    expect(result).toContain('getControl(name: "ownerid"): Xrm.Controls.LookupControl;');
  });

  it('should include fallback signatures', () => {
    const form = createForm('Account', ['name']);
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', createAttr('name', 'String')],
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    expect(result).toContain('getAttribute(name: string): Xrm.Attributes.Attribute;');
    expect(result).toContain('getControl(name: string): Xrm.Controls.Control;');
  });

  it('should deduplicate fields across tabs/sections', () => {
    // Same field on two different tabs
    const form: ParsedForm = {
      name: 'Account',
      formId: 'form-1',
      isDefault: true,
      tabs: [
        { name: 'Tab1', sections: [{ name: 'S1', controls: [{ id: 'name', datafieldname: 'name', classid: '' }] }] },
        { name: 'Tab2', sections: [{ name: 'S2', controls: [{ id: 'name2', datafieldname: 'name', classid: '' }] }] },
      ],
      allControls: [
        { id: 'name', datafieldname: 'name', classid: '' },
        { id: 'name2', datafieldname: 'name', classid: '' },
      ],
    };
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', createAttr('name', 'String')],
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    // "name" should appear exactly once in getAttribute overloads
    const getAttrMatches = result.match(/getAttribute\(name: "name"\)/g);
    expect(getAttrMatches).toHaveLength(1);
  });

  it('should skip fields not found in attribute metadata', () => {
    const form = createForm('Account', ['name', 'unknown_field']);
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', createAttr('name', 'String')],
      // unknown_field deliberately not in map
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    expect(result).toContain('getAttribute(name: "name")');
    expect(result).not.toContain('unknown_field');
  });

  it('should handle all attribute types correctly', () => {
    const form = createForm('Account', ['name', 'revenue', 'donotemail', 'createdon', 'statuscode', 'parentaccountid']);
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', createAttr('name', 'String')],
      ['revenue', createAttr('revenue', 'Money')],
      ['donotemail', createAttr('donotemail', 'Boolean')],
      ['createdon', createAttr('createdon', 'DateTime')],
      ['statuscode', createAttr('statuscode', 'Status')],
      ['parentaccountid', createAttr('parentaccountid', 'Lookup')],
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    expect(result).toContain('Xrm.Attributes.StringAttribute');
    expect(result).toContain('Xrm.Attributes.NumberAttribute');
    expect(result).toContain('Xrm.Attributes.BooleanAttribute');
    expect(result).toContain('Xrm.Attributes.DateAttribute');
    expect(result).toContain('Xrm.Attributes.OptionSetAttribute');
    expect(result).toContain('Xrm.Attributes.LookupAttribute');
  });
});

describe('generateEntityForms', () => {
  it('should generate interfaces for all forms', () => {
    const forms = [
      createForm('Account', ['name']),
      createForm('Quick Create', ['name']),
    ];
    const attributes = [createAttr('name', 'String')];

    const results = generateEntityForms(forms, 'account', attributes);

    expect(results).toHaveLength(2);
    expect(results[0].interfaceName).toBe('AccountAccountForm');
    expect(results[1].interfaceName).toBe('AccountQuickCreateForm');
  });

  it('should skip forms with no controls', () => {
    const forms: ParsedForm[] = [{
      name: 'Empty',
      formId: 'form-1',
      isDefault: false,
      tabs: [],
      allControls: [],
    }];

    const results = generateEntityForms(forms, 'account', []);

    expect(results).toHaveLength(0);
  });
});
