import { describe, it, expect } from 'vitest';
import { generateFormInterface, generateEntityForms } from '../src/generators/form-generator.js';
import type { ParsedForm, AttributeMetadata } from '../src/metadata/types.js';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createAttr(logicalName: string, attributeType: string, label: string = ''): AttributeMetadata {
  return {
    LogicalName: logicalName,
    SchemaName: logicalName.charAt(0).toUpperCase() + logicalName.slice(1),
    AttributeType: attributeType,
    DisplayName: label
      ? { LocalizedLabels: [{ Label: label, LanguageCode: 1033 }], UserLocalizedLabel: null }
      : { LocalizedLabels: [], UserLocalizedLabel: null },
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

// ─── Union Type + Mapped Return Type Tests ───────────────────────────────────

describe('generateFormInterface', () => {
  it('should generate union type for form fields', () => {
    const form = createForm('Account', ['name', 'telephone1']);
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', createAttr('name', 'String', 'Account Name')],
      ['telephone1', createAttr('telephone1', 'String', 'Main Phone')],
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    // Union type with only form fields
    expect(result).toContain('type AccountFormFields =');
    expect(result).toContain('| "name"');
    expect(result).toContain('| "telephone1"');
  });

  it('should generate attribute map with correct types', () => {
    const form = createForm('Account', ['name', 'revenue', 'ownerid']);
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', createAttr('name', 'String', 'Account Name')],
      ['revenue', createAttr('revenue', 'Money', 'Annual Revenue')],
      ['ownerid', createAttr('ownerid', 'Owner', 'Owner')],
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    expect(result).toContain('type AccountFormAttributeMap = {');
    expect(result).toContain('name: Xrm.Attributes.StringAttribute;');
    expect(result).toContain('revenue: Xrm.Attributes.NumberAttribute;');
    expect(result).toContain('ownerid: Xrm.Attributes.LookupAttribute;');
  });

  it('should generate control map with correct types', () => {
    const form = createForm('Account', ['name', 'revenue', 'ownerid']);
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', createAttr('name', 'String', 'Account Name')],
      ['revenue', createAttr('revenue', 'Money', 'Annual Revenue')],
      ['ownerid', createAttr('ownerid', 'Owner', 'Owner')],
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    expect(result).toContain('type AccountFormControlMap = {');
    expect(result).toContain('name: Xrm.Controls.StringControl;');
    expect(result).toContain('revenue: Xrm.Controls.NumberControl;');
    expect(result).toContain('ownerid: Xrm.Controls.LookupControl;');
  });

  it('should generate generic getAttribute with union constraint (no fallback)', () => {
    const form = createForm('Account', ['name']);
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', createAttr('name', 'String', 'Account Name')],
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    // Generic with union constraint
    expect(result).toContain('getAttribute<K extends AccountFormFields>(name: K): AccountFormAttributeMap[K];');
    // Index and collection access still available
    expect(result).toContain('getAttribute(index: number): Xrm.Attributes.Attribute;');
    expect(result).toContain('getAttribute(): Xrm.Attributes.Attribute[];');
    // NO string fallback
    expect(result).not.toContain('getAttribute(name: string)');
  });

  it('should generate generic getControl with union constraint (no fallback)', () => {
    const form = createForm('Account', ['name']);
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', createAttr('name', 'String', 'Account Name')],
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    expect(result).toContain('getControl<K extends AccountFormFields>(name: K): AccountFormControlMap[K];');
    expect(result).toContain('getControl(index: number): Xrm.Controls.Control;');
    expect(result).toContain('getControl(): Xrm.Controls.Control[];');
    expect(result).not.toContain('getControl(name: string)');
  });

  it('should generate Fields const enum with labels', () => {
    const form = createForm('Account', ['name', 'telephone1']);
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', createAttr('name', 'String', 'Account Name')],
      ['telephone1', createAttr('telephone1', 'String', 'Main Phone')],
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    expect(result).toContain('const enum AccountFormFieldsEnum {');
    expect(result).toContain("AccountName = 'name',");
    expect(result).toContain("MainPhone = 'telephone1',");
  });

  it('should generate dual-language labels in Fields enum', () => {
    const form = createForm('Account', ['name']);
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', {
        ...createAttr('name', 'String'),
        DisplayName: {
          LocalizedLabels: [
            { Label: 'Account Name', LanguageCode: 1033 },
            { Label: 'Firmenname', LanguageCode: 1031 },
          ],
          UserLocalizedLabel: null,
        },
      }],
    ]);

    const result = generateFormInterface(form, 'account', attrMap, {
      labelConfig: { primaryLanguage: 1033, secondaryLanguage: 1031 },
    });

    expect(result).toContain('/** Account Name | Firmenname */');
  });

  it('should deduplicate fields across tabs/sections', () => {
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
      ['name', createAttr('name', 'String', 'Account Name')],
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    // "name" should appear exactly once in the union type
    const unionMatches = result.match(/\| "name"/g);
    expect(unionMatches).toHaveLength(1);
  });

  it('should skip fields not found in attribute metadata', () => {
    const form = createForm('Account', ['name', 'unknown_field']);
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', createAttr('name', 'String', 'Account Name')],
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    expect(result).toContain('"name"');
    expect(result).not.toContain('unknown_field');
  });

  it('should generate = never for form with 0 recognized controls (BPF)', () => {
    // A form with controls whose datafieldnames are not in the attribute map
    const form = createForm('BPF', []);
    const attrMap = new Map<string, AttributeMetadata>();

    const result = generateFormInterface(form, 'account', attrMap);

    expect(result).toContain('type AccountBPFFormFields = never;');
    expect(result).toContain('type AccountBPFFormAttributeMap = Record<string, never>;');
    expect(result).toContain('type AccountBPFFormControlMap = Record<string, never>;');
  });

  it('should use Omit<FormContext> for the interface', () => {
    const form = createForm('Account', ['name']);
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', createAttr('name', 'String', 'Account Name')],
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    expect(result).toContain("extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'>");
  });

  it('should transliterate umlauts in form names (M2)', () => {
    const form = createForm('Übersicht', ['name']);
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', createAttr('name', 'String', 'Account Name')],
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    expect(result).toContain('AccountUebersichtForm');
    // Interface name is transliterated, but JSDoc keeps the original form name
    expect(result).toContain('/** Übersicht */');
    // The interface NAME should NOT contain the raw umlaut
    expect(result).not.toContain('interface AccountÜbersichtForm');
  });
});

describe('generateEntityForms', () => {
  it('should generate interfaces for all forms', () => {
    const forms = [
      createForm('Account', ['name']),
      createForm('Quick Create', ['name']),
    ];
    const attributes = [createAttr('name', 'String', 'Account Name')];

    const results = generateEntityForms(forms, 'account', attributes);

    expect(results).toHaveLength(2);
    expect(results[0].interfaceName).toBe('AccountForm');
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

  it('should disambiguate duplicate form names with numeric suffix', () => {
    const forms = [
      createForm('Kontakt', ['firstname']),
      createForm('Kontakt', ['firstname', 'lastname']),
      createForm('Kontakt', ['firstname', 'emailaddress1']),
    ];
    const attributes = [
      createAttr('firstname', 'String', 'First Name'),
      createAttr('lastname', 'String', 'Last Name'),
      createAttr('emailaddress1', 'String', 'Email'),
    ];

    const results = generateEntityForms(forms, 'contact', attributes);

    expect(results).toHaveLength(3);
    // First occurrence keeps original name, subsequent get numeric suffix
    expect(results[0].interfaceName).toBe('ContactKontaktForm');
    expect(results[1].interfaceName).toBe('ContactKontakt2Form');
    expect(results[2].interfaceName).toBe('ContactKontakt3Form');

    // Each generates unique type names
    expect(results[0].content).toContain('type ContactKontaktFormFields =');
    expect(results[1].content).toContain('type ContactKontakt2FormFields =');
    expect(results[2].content).toContain('type ContactKontakt3FormFields =');
  });

  it('should not add suffix when form names are already unique', () => {
    const forms = [
      createForm('Main', ['name']),
      createForm('Quick Create', ['name']),
    ];
    const attributes = [createAttr('name', 'String', 'Name')];

    const results = generateEntityForms(forms, 'account', attributes);

    expect(results[0].interfaceName).toBe('AccountMainForm');
    expect(results[1].interfaceName).toBe('AccountQuickCreateForm');
  });
});

describe('tab/section disambiguation', () => {
  it('should disambiguate duplicate tab names within a form', () => {
    const form: ParsedForm = {
      name: 'Insights',
      formId: 'form-insights',
      isDefault: true,
      tabs: [
        { name: 'Insights', label: 'Insights 1', sections: [{ name: 'S1', label: 'Section 1', controls: [{ id: 'f1', datafieldname: 'statecode', classid: '' }] }] },
        { name: 'Insights', label: 'Insights 2', sections: [{ name: 'S2', label: 'Section 2', controls: [] }] },
      ],
      allControls: [{ id: 'f1', datafieldname: 'statecode', classid: '' }],
    };
    const attributes = [createAttr('statecode', 'State', 'Status')];

    const result = generateFormInterface(form, 'contact', new Map(attributes.map((a) => [a.LogicalName, a])));

    // Tab enum members should be disambiguated
    expect(result).toContain("Insights = 'Insights'");
    expect(result).toContain("Insights2 = 'Insights'");

    // Section enum names should use disambiguated tab member names
    expect(result).toContain('const enum ContactInsightsFormInsightsSections {');
    expect(result).toContain('const enum ContactInsightsFormInsights2Sections {');
  });
});
