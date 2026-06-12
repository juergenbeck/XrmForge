/**
 * Determinism Audit (OE-11, Release 1)
 *
 * Two generator runs over the same metadata MUST produce byte-identical
 * output. This is a prerequisite for drift detection (generate --check):
 * a check that compares freshly generated output against the checked-in
 * files byte-by-byte must never go red without a real metadata change.
 *
 * Covered generators: entity interface, OptionSet enums, form interfaces,
 * entity fields enum, navigation properties, entity names enum,
 * ActivityParty interface, action modules, action declarations, barrel index.
 *
 * Uses the real Account metadata fixture (extracted from a live environment)
 * plus synthetic Custom API definitions.
 */

import { describe, it, expect } from 'vitest';
import { loadAccountEntityTypeInfo } from './fixtures/load-fixture.js';
import { generateEntityInterface } from '../src/generators/entity-generator.js';
import { generateEntityOptionSets } from '../src/generators/optionset-generator.js';
import { generateEntityForms } from '../src/generators/form-generator.js';
import { generateEntityFieldsEnum, generateEntityNavigationProperties } from '../src/generators/entity-fields-generator.js';
import { generateEntityNamesEnum } from '../src/generators/entity-names-generator.js';
import { generateActivityPartyInterface } from '../src/generators/activity-party.js';
import { generateActionModule, generateActionDeclarations, groupCustomApis } from '../src/generators/action-generator.js';
import { addGeneratedHeader, generateBarrelIndex } from '../src/orchestrator/file-writer.js';
import type { GeneratedFile } from '../src/orchestrator/types.js';
import type { CustomApiTypeInfo } from '../src/metadata/custom-api-types.js';
import type { LabelConfig } from '../src/generators/label-utils.js';

const DUAL_LABEL: LabelConfig = { primaryLanguage: 1033, secondaryLanguage: 1031 };

const CUSTOM_APIS: CustomApiTypeInfo[] = [
  {
    api: {
      uniquename: 'lm_SetStatus',
      bindingtype: 0,
      isfunction: false,
      boundentitylogicalname: null,
      displayname: 'Set Status',
      description: 'Sets state and status of a record',
    },
    requestParameters: [
      { uniquename: 'EntityId', type: 10, isoptional: false },
      { uniquename: 'EntityName', type: 10, isoptional: false },
      { uniquename: 'StateCode', type: 7, isoptional: false },
      { uniquename: 'StatusCode', type: 7, isoptional: false },
    ],
    responseProperties: [],
  },
  {
    api: {
      uniquename: 'markant_winquote',
      bindingtype: 1,
      isfunction: false,
      boundentitylogicalname: 'quote',
      displayname: 'Win Quote',
    },
    requestParameters: [],
    responseProperties: [
      { uniquename: 'IsValid', type: 0 },
      { uniquename: 'Message', type: 10 },
    ],
  },
  {
    api: {
      uniquename: 'WhoAmI',
      bindingtype: 0,
      isfunction: true,
      boundentitylogicalname: null,
      displayname: 'Who Am I',
    },
    requestParameters: [],
    responseProperties: [{ uniquename: 'UserId', type: 12 }],
  },
];

describe('determinism audit: double run is byte-identical', () => {
  it('entity interface generator', () => {
    const info = loadAccountEntityTypeInfo();
    const first = generateEntityInterface(info, { labelConfig: DUAL_LABEL });
    const second = generateEntityInterface(info, { labelConfig: DUAL_LABEL });
    expect(second).toBe(first);
  });

  it('OptionSet enum generator', () => {
    const info = loadAccountEntityTypeInfo();
    const attrs = info.picklistAttributes.map((p) => ({
      SchemaName: p.SchemaName,
      OptionSet: p.OptionSet ?? null,
      GlobalOptionSet: p.GlobalOptionSet ?? null,
    }));
    const render = () =>
      generateEntityOptionSets(attrs, 'account', { labelConfig: DUAL_LABEL })
        .map((os) => os.content)
        .join('\n');
    expect(render()).toBe(render());
  });

  it('form interface generator', () => {
    const info = loadAccountEntityTypeInfo();
    const render = () =>
      generateEntityForms(info.forms, 'account', info.attributes, { labelConfig: DUAL_LABEL })
        .map((f) => f.content)
        .join('\n');
    expect(render()).toBe(render());
  });

  it('entity fields enum and navigation properties generator', () => {
    const info = loadAccountEntityTypeInfo();
    const render = () =>
      generateEntityFieldsEnum(info, { labelConfig: DUAL_LABEL }) +
      generateEntityNavigationProperties(info, { labelConfig: DUAL_LABEL });
    expect(render()).toBe(render());
  });

  it('entity names enum generator', () => {
    const names = ['contact', 'account', 'lm_leistung', 'quote'];
    expect(generateEntityNamesEnum(names)).toBe(generateEntityNamesEnum(names));
  });

  it('ActivityParty interface generator', () => {
    expect(generateActivityPartyInterface()).toBe(generateActivityPartyInterface());
  });

  it('action module and declaration generators', () => {
    const renderModules = () => {
      const grouped = groupCustomApis(CUSTOM_APIS);
      const parts: string[] = [];
      for (const [key, apis] of grouped.actions) {
        parts.push(`// actions/${key}`, generateActionModule(apis, false));
      }
      for (const [key, apis] of grouped.functions) {
        parts.push(`// functions/${key}`, generateActionModule(apis, true));
      }
      return parts.join('\n');
    };
    expect(renderModules()).toBe(renderModules());

    const renderDeclarations = () => generateActionDeclarations(CUSTOM_APIS, false);
    expect(renderDeclarations()).toBe(renderDeclarations());
  });

  it('barrel index and generated header', () => {
    const files: GeneratedFile[] = [
      { relativePath: 'entities/account.ts', content: 'a', type: 'entity' },
      { relativePath: 'forms/account.ts', content: 'b', type: 'form' },
      { relativePath: 'fields/account.ts', content: 'c', type: 'fields' },
      { relativePath: 'optionsets/account.ts', content: 'd', type: 'optionset' },
      { relativePath: 'actions/global.ts', content: 'e', type: 'action' },
    ];
    expect(generateBarrelIndex(files)).toBe(generateBarrelIndex(files));
    expect(addGeneratedHeader('content')).toBe(addGeneratedHeader('content'));
  });

  it('generated output contains no timestamps or tool version stamps', () => {
    const info = loadAccountEntityTypeInfo();
    const output = [
      addGeneratedHeader(generateEntityInterface(info, { labelConfig: DUAL_LABEL })),
      addGeneratedHeader(generateEntityFieldsEnum(info, { labelConfig: DUAL_LABEL })),
      addGeneratedHeader(generateEntityNamesEnum(['account'])),
      addGeneratedHeader(generateActionModule(CUSTOM_APIS, false)),
    ].join('\n');

    // ISO dates (2026-06-12), timestamps (12:34:56), or semver stamps (v0.10.1)
    // in the output would break byte-comparison between runs.
    expect(output).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(output).not.toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(output).not.toMatch(/v\d+\.\d+\.\d+/);
  });
});
