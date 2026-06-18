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

function createForm(name: string, fields: string[], type: number = 2): ParsedForm {
  return {
    name,
    formId: 'form-1',
    isDefault: true,
    type,
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

  it('should always include statuscode/statecode in fields when present in attribute map', () => {
    const form = createForm('Account', ['name']);
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', createAttr('name', 'String', 'Account Name')],
      ['statuscode', createAttr('statuscode', 'Status', 'Status Reason')],
      ['statecode', createAttr('statecode', 'State', 'Status')],
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    // statuscode and statecode should be included even though they have no FormXml control
    expect(result).toContain('| "statuscode"');
    expect(result).toContain('| "statecode"');
    expect(result).toContain("StatusReason = 'statuscode',");
    expect(result).toContain("Status = 'statecode',");
  });

  it('should not include statuscode/statecode when not in attribute map', () => {
    const form = createForm('Account', ['name']);
    const attrMap = new Map<string, AttributeMetadata>([
      ['name', createAttr('name', 'String', 'Account Name')],
    ]);

    const result = generateFormInterface(form, 'account', attrMap);

    expect(result).not.toContain('statuscode');
    expect(result).not.toContain('statecode');
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

  it('should suffix Quick Create forms (type 7) so they do not collide with the same-named Main form', () => {
    const forms = [
      createForm('Account', ['name'], 2),
      createForm('Account', ['name', 'telephone1'], 7),
    ];
    const attributes = [
      createAttr('name', 'String', 'Account Name'),
      createAttr('telephone1', 'String', 'Main Phone'),
    ];

    const results = generateEntityForms(forms, 'account', attributes);

    expect(results).toHaveLength(2);
    expect(results[0].interfaceName).toBe('AccountForm');
    expect(results[1].interfaceName).toBe('AccountQuickCreateForm');
    // The Quick Create interface has its own distinct field set
    expect(results[1].content).toContain('type AccountQuickCreateFormFields =');
  });

  it('should disambiguate two same-named Quick Create forms with a numeric suffix', () => {
    const forms = [
      createForm('Account', ['name'], 7),
      createForm('Account', ['name'], 7),
    ];
    const attributes = [createAttr('name', 'String', 'Account Name')];

    const results = generateEntityForms(forms, 'account', attributes);

    expect(results).toHaveLength(2);
    expect(results[0].interfaceName).toBe('AccountQuickCreateForm');
    expect(results[1].interfaceName).toBe('AccountQuickCreate2Form');
  });

  it('exposes per-form metadata for form-mapping.json: fields, isMain, enum names (F-MAR7-04)', () => {
    const forms = [
      createForm('Account', ['name', 'telephone1'], 2),
      createForm('Account', ['name'], 7),
    ];
    const attributes = [
      createAttr('name', 'String', 'Account Name'),
      createAttr('telephone1', 'String', 'Main Phone'),
    ];

    const results = generateEntityForms(forms, 'account', attributes);

    // Main form (type 2): isMain true, fields sorted, enum names derived from base name
    expect(results[0].isMain).toBe(true);
    expect(results[0].fields).toEqual(['name', 'telephone1']);
    expect(results[0].fieldsEnumName).toBe('AccountFormFieldsEnum');
    expect(results[0].tabsEnumName).toBe('AccountFormTabs');

    // Quick Create form (type 7): isMain false, own (smaller) field set
    expect(results[1].isMain).toBe(false);
    expect(results[1].fields).toEqual(['name']);
    expect(results[1].fieldsEnumName).toBe('AccountQuickCreateFormFieldsEnum');
  });

  it('reports tabsEnumName as empty when a form has no named tabs (F-MAR7-04)', () => {
    const form: ParsedForm = {
      name: 'Account',
      formId: 'form-1',
      isDefault: true,
      type: 2,
      tabs: [],
      allControls: [{ id: 'name', datafieldname: 'name', classid: '' }],
    };

    const results = generateEntityForms([form], 'account', [createAttr('name', 'String', 'Name')]);

    expect(results[0].tabsEnumName).toBe('');
    expect(results[0].fields).toEqual(['name']);
  });
});

describe('typed sections keep the ItemCollection base (F-LMA7-10)', () => {
  it('emits sections as ItemCollection<Section> intersection so get(index)/forEach/getLength stay available', () => {
    const form = createForm('Account', ['name']);
    const attributeMap = new Map<string, AttributeMetadata>([['name', createAttr('name', 'String', 'Name')]]);

    const content = generateFormInterface(form, 'account', attributeMap);

    // The typed sections must extend the Xrm ItemCollection base, not replace it with a
    // bare { get(name) } object (which would hide get(index)/forEach/getLength; F-LMA7-10).
    expect(content).toContain('sections: Xrm.Collection.ItemCollection<Xrm.Controls.Section> & {');
    expect(content).toContain('get(name: "General"): Xrm.Controls.Section;');
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

describe('apostrophes in FormXML names (K32-02)', () => {
  it('escapes a single quote in a section name so the emitted literal is valid TS', () => {
    const form: ParsedForm = {
      name: 'Notes',
      formId: 'form-notes',
      isDefault: true,
      tabs: [
        {
          name: 'General',
          label: 'General',
          sections: [
            { name: "note's information", label: 'Notes', controls: [{ id: 'f1', datafieldname: 'subject', classid: '' }] },
          ],
        },
      ],
      allControls: [{ id: 'f1', datafieldname: 'subject', classid: '' }],
    };
    const attributes = [createAttr('subject', 'String', 'Subject')];

    const result = generateFormInterface(form, 'annotation', new Map(attributes.map((a) => [a.LogicalName, a])));

    // The raw value must be escaped (would otherwise be an unterminated literal).
    expect(result).toContain("= 'note\\'s information',");
    expect(result).not.toContain("= 'note's information',");
  });

  it('escapes an apostrophe in a tab name', () => {
    const form: ParsedForm = {
      name: 'Quote',
      formId: 'form-quote',
      isDefault: true,
      tabs: [
        {
          name: "customer's tab",
          label: 'Customer',
          sections: [{ name: 'S1', label: 'S1', controls: [{ id: 'f1', datafieldname: 'name', classid: '' }] }],
        },
      ],
      allControls: [{ id: 'f1', datafieldname: 'name', classid: '' }],
    };
    const attributes = [createAttr('name', 'String', 'Name')];

    const result = generateFormInterface(form, 'quote', new Map(attributes.map((a) => [a.LogicalName, a])));

    expect(result).toContain("= 'customer\\'s tab',");
  });
});
