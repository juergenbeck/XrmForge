import { describe, it, expect } from 'vitest';
import { loadAccountEntityTypeInfo } from '../fixtures/load-fixture.js';
import { generateEntityInterface } from '../../src/generators/entity-generator.js';
import { generateEntityOptionSets } from '../../src/generators/optionset-generator.js';
import { generateEntityForms } from '../../src/generators/form-generator.js';
import type { LabelConfig } from '../../src/generators/label-utils.js';

const DUAL_LABEL: LabelConfig = { primaryLanguage: 1033, secondaryLanguage: 1031 };

// Load fixture once (expensive: parses FormXml)
const entityInfo = loadAccountEntityTypeInfo();

// ─── Entity Generator ────────────────────────────────────────────────────────

describe('entity-generator with real Account metadata', () => {
  const output = generateEntityInterface(entityInfo, { labelConfig: DUAL_LABEL });

  it('should generate valid TypeScript declaration', () => {
    expect(output).toContain('declare namespace XrmForge.Entities {');
    expect(output).toContain('interface Account {');
    expect(output).toMatch(/}\s*$/); // Properly closed
  });

  it('should include standard String attributes', () => {
    expect(output).toContain('name?: string;');
    expect(output).toContain('telephone1?: string;');
  });

  it('should include Money attributes as number', () => {
    expect(output).toContain('creditlimit?: number;');
    expect(output).toContain('revenue?: number;');
  });

  it('should include Boolean attributes', () => {
    expect(output).toContain('donotemail?: boolean;');
    expect(output).toContain('creditonhold?: boolean;');
  });

  it('should include DateTime attributes as string', () => {
    expect(output).toContain('createdon?: string;');
    expect(output).toContain('modifiedon?: string;');
  });

  it('should generate dual-language JSDoc', () => {
    // Account entity has both EN and DE labels
    expect(output).toContain('/** Account | Firma */');
  });

  it('should mark read-only fields', () => {
    // address1_composite is read-only (IsValidForCreate=false, IsValidForUpdate=false)
    expect(output).toContain('read-only');
  });

  it('should include lookup fields with _value pattern', () => {
    expect(output).toContain('_primarycontactid_value?: string;');
    expect(output).toContain('_parentaccountid_value?: string;');
  });
});

// ─── OptionSet Generator ─────────────────────────────────────────────────────

describe('optionset-generator with real Account picklists', () => {
  const picklistAttrs = entityInfo.picklistAttributes.map((p) => ({
    SchemaName: p.SchemaName,
    OptionSet: p.OptionSet ?? null,
    GlobalOptionSet: p.GlobalOptionSet ?? null,
  }));

  const optionSets = generateEntityOptionSets(picklistAttrs, 'account', { labelConfig: DUAL_LABEL });

  it('should generate const enums for picklist attributes', () => {
    expect(optionSets.length).toBeGreaterThan(0);
    for (const os of optionSets) {
      expect(os.content).toContain('const enum');
    }
  });

  it('should generate valid TypeScript syntax', () => {
    for (const os of optionSets) {
      expect(os.content).toContain('declare namespace XrmForge.OptionSets {');
      expect(os.content).toMatch(/}\s*$/);
    }
  });

  it('should include IndustryCode with multiple options', () => {
    const industry = optionSets.find((os) => os.enumName === 'IndustryCode');
    expect(industry).toBeDefined();
    expect(industry!.content).toContain('Accounting');
  });

  it('should generate dual-language labels in enums', () => {
    // At least some enums should have dual labels
    const allContent = optionSets.map((os) => os.content).join('\n');
    expect(allContent).toContain(' | ');
  });
});

// ─── Form Generator ──────────────────────────────────────────────────────────

describe('form-generator with real Account form', () => {
  const formResults = generateEntityForms(
    entityInfo.forms,
    'account',
    entityInfo.attributes,
    { labelConfig: DUAL_LABEL },
  );

  it('should generate at least one form interface', () => {
    expect(formResults.length).toBeGreaterThan(0);
  });

  it('should extend Omit<Xrm.FormContext>', () => {
    for (const form of formResults) {
      expect(form.content).toContain("extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'>");
    }
  });

  it('should generate getAttribute overloads for form fields', () => {
    const accountForm = formResults[0];
    expect(accountForm.content).toContain('getAttribute(name: "name"): Xrm.Attributes.StringAttribute;');
  });

  it('should generate getControl overloads', () => {
    const accountForm = formResults[0];
    expect(accountForm.content).toContain('getControl(name: "name"): Xrm.Controls.StringControl;');
  });

  it('should include fallback signatures', () => {
    const accountForm = formResults[0];
    expect(accountForm.content).toContain('getAttribute(name: string): Xrm.Attributes.Attribute;');
    expect(accountForm.content).toContain('getAttribute(index: number): Xrm.Attributes.Attribute;');
    expect(accountForm.content).toContain('getAttribute(): Xrm.Attributes.Attribute[];');
    expect(accountForm.content).toContain('getControl(name: string): Xrm.Controls.Control;');
  });

  it('should include Lookup controls as LookupControl', () => {
    const accountForm = formResults[0];
    // primarycontactid should be on the form
    if (accountForm.content.includes('primarycontactid')) {
      expect(accountForm.content).toContain('getControl(name: "primarycontactid"): Xrm.Controls.LookupControl;');
    }
  });
});
