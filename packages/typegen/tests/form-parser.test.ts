import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseForm, extractControlFields } from '../src/metadata/form-parser.js';
import { configureLogging, SilentLogSink, ConsoleLogSink, LogLevel } from '../src/logger.js';
import type { SystemFormMetadata } from '../src/metadata/types.js';

beforeEach(() => configureLogging({ sink: new SilentLogSink() }));
afterEach(() => configureLogging({ sink: new ConsoleLogSink(), minLevel: LogLevel.INFO }));

// ─── Test FormXml ────────────────────────────────────────────────────────────

const SAMPLE_FORMXML = `<form>
  <tabs>
    <tab name="SUMMARY_TAB" id="{00000000-0000-0000-0000-000000000001}">
      <labels>
        <label description="Summary" languagecode="1033" />
      </labels>
      <columns>
        <column width="100%">
          <sections>
            <section name="ACCOUNT_INFORMATION" id="{00000000-0000-0000-0000-000000000002}">
              <labels>
                <label description="Account Info" languagecode="1033" />
              </labels>
              <rows>
                <row>
                  <cell id="{cell1}">
                    <control id="name" classid="{4273EDBD-AC1D-40D3-9FB2-095C621B552D}" datafieldname="name" />
                  </cell>
                </row>
                <row>
                  <cell id="{cell2}">
                    <control id="telephone1" classid="{4273EDBD-AC1D-40D3-9FB2-095C621B552D}" datafieldname="telephone1" />
                  </cell>
                </row>
                <row>
                  <cell id="{cell3}">
                    <control id="primarycontactid" classid="{270BD3DB-D9AF-4782-9025-509E298DEC0A}" datafieldname="primarycontactid" />
                  </cell>
                </row>
              </rows>
            </section>
            <section name="ADDRESS" id="{00000000-0000-0000-0000-000000000003}">
              <labels>
                <label description="Address" languagecode="1033" />
              </labels>
              <rows>
                <row>
                  <cell id="{cell4}">
                    <control id="address1_line1" classid="{4273EDBD-AC1D-40D3-9FB2-095C621B552D}" datafieldname="address1_line1" />
                  </cell>
                </row>
              </rows>
            </section>
          </sections>
        </column>
      </columns>
    </tab>
    <tab name="DETAILS_TAB" id="{00000000-0000-0000-0000-000000000004}">
      <labels>
        <label description="Details" languagecode="1033" />
      </labels>
      <columns>
        <column width="100%">
          <sections>
            <section name="FINANCIALS" id="{00000000-0000-0000-0000-000000000005}">
              <labels>
                <label description="Financials" languagecode="1033" />
              </labels>
              <rows>
                <row>
                  <cell id="{cell5}">
                    <control id="revenue" classid="{4273EDBD-AC1D-40D3-9FB2-095C621B552D}" datafieldname="revenue" />
                  </cell>
                </row>
              </rows>
            </section>
          </sections>
        </column>
      </columns>
    </tab>
  </tabs>
</form>`;

function createFormMetadata(overrides?: Partial<SystemFormMetadata>): SystemFormMetadata {
  return {
    name: 'Account',
    formid: '8448b78f-8f42-454e-8e2a-f8196b0419af',
    formxml: SAMPLE_FORMXML,
    description: null,
    isdefault: true,
    ...overrides,
  };
}

// ─── parseForm ───────────────────────────────────────────────────────────────

describe('parseForm', () => {
  it('should parse tabs correctly', () => {
    const result = parseForm(createFormMetadata());

    expect(result.tabs).toHaveLength(2);
    expect(result.tabs[0]!.name).toBe('SUMMARY_TAB');
    expect(result.tabs[1]!.name).toBe('DETAILS_TAB');
  });

  it('should parse sections within tabs', () => {
    const result = parseForm(createFormMetadata());

    const summaryTab = result.tabs[0]!;
    expect(summaryTab.sections).toHaveLength(2);
    expect(summaryTab.sections[0]!.name).toBe('ACCOUNT_INFORMATION');
    expect(summaryTab.sections[1]!.name).toBe('ADDRESS');
  });

  it('should parse controls within sections', () => {
    const result = parseForm(createFormMetadata());

    const accountInfoSection = result.tabs[0]!.sections[0]!;
    expect(accountInfoSection.controls).toHaveLength(3);
    expect(accountInfoSection.controls[0]!.datafieldname).toBe('name');
    expect(accountInfoSection.controls[1]!.datafieldname).toBe('telephone1');
    expect(accountInfoSection.controls[2]!.datafieldname).toBe('primarycontactid');
  });

  it('should extract classid for control type identification', () => {
    const result = parseForm(createFormMetadata());

    const controls = result.tabs[0]!.sections[0]!.controls;
    // Standard text field
    expect(controls[0]!.classid).toBe('{4273EDBD-AC1D-40D3-9FB2-095C621B552D}');
    // Lookup
    expect(controls[2]!.classid).toBe('{270BD3DB-D9AF-4782-9025-509E298DEC0A}');
  });

  it('should provide flattened allControls', () => {
    const result = parseForm(createFormMetadata());

    expect(result.allControls).toHaveLength(5);
    const fieldNames = result.allControls.map((c) => c.datafieldname);
    expect(fieldNames).toEqual(['name', 'telephone1', 'primarycontactid', 'address1_line1', 'revenue']);
  });

  it('should preserve form metadata', () => {
    const result = parseForm(createFormMetadata());

    expect(result.name).toBe('Account');
    expect(result.formId).toBe('8448b78f-8f42-454e-8e2a-f8196b0419af');
    expect(result.isDefault).toBe(true);
  });

  it('should handle empty formxml gracefully', () => {
    const result = parseForm(createFormMetadata({ formxml: '' }));

    expect(result.tabs).toHaveLength(0);
    expect(result.allControls).toHaveLength(0);
  });

  it('should handle formxml without controls', () => {
    const xml = '<form><tabs><tab name="EMPTY" id="{guid}"><columns><column><sections><section name="EMPTY_SEC" id="{guid}"><rows></rows></section></sections></column></columns></tab></tabs></form>';
    const result = parseForm(createFormMetadata({ formxml: xml }));

    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0]!.sections[0]!.controls).toHaveLength(0);
  });

  it('should skip controls without datafieldname (R4-15)', () => {
    const xml = `<form><tabs><tab name="T1" id="{g}"><columns><column><sections><section name="S1" id="{g}"><rows>
      <row><cell id="{c1}"><control id="name" classid="{4273EDBD-AC1D-40D3-9FB2-095C621B552D}" datafieldname="name" /></cell></row>
      <row><cell id="{c2}"><control id="subgrid1" classid="{E7A81278-8635-4D9E-8D4D-59480B391C5B}" /></cell></row>
      <row><cell id="{c3}"><control id="telephone1" classid="{4273EDBD-AC1D-40D3-9FB2-095C621B552D}" datafieldname="telephone1" /></cell></row>
    </rows></section></sections></column></columns></tab></tabs></form>`;

    const result = parseForm(createFormMetadata({ formxml: xml }));

    // SubGrid (no datafieldname) should be skipped, only data-bound controls remain
    expect(result.allControls).toHaveLength(2);
    expect(result.allControls[0]!.datafieldname).toBe('name');
    expect(result.allControls[1]!.datafieldname).toBe('telephone1');
  });
});

// ─── extractControlFields ────────────────────────────────────────────────────

describe('extractControlFields', () => {
  it('should extract all unique field names', () => {
    const fields = extractControlFields(SAMPLE_FORMXML);

    expect(fields).toEqual(['name', 'telephone1', 'primarycontactid', 'address1_line1', 'revenue']);
  });

  it('should deduplicate field names', () => {
    const xml = `<form>
      <control id="name" classid="{guid}" datafieldname="name" />
      <control id="name2" classid="{guid}" datafieldname="name" />
    </form>`;

    const fields = extractControlFields(xml);
    expect(fields).toEqual(['name']);
  });

  it('should return empty array for formxml without controls', () => {
    const fields = extractControlFields('<form><tabs></tabs></form>');
    expect(fields).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    const fields = extractControlFields('');
    expect(fields).toEqual([]);
  });
});
