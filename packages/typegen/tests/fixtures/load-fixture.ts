/**
 * Test fixture loader.
 * Loads the real Account entity metadata fixture extracted from markant-dev.crm4.dynamics.com.
 * Used by integration and E2E tests.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseForm } from '../../src/metadata/form-parser.js';
import type {
  EntityTypeInfo,
  AttributeMetadata,
  LookupAttributeMetadata,
  PicklistAttributeMetadata,
  StatusAttributeMetadata,
  StateAttributeMetadata,
} from '../../src/metadata/types.js';

/** Path to the fixture file (extracted from real Dataverse metadata) */
const FIXTURE_PATH = join(__dirname, '..', '..', '..', '..', 'examples', 'account-form-demo', 'fixtures', 'account-metadata-fixture.json');

/** Raw fixture data as parsed JSON */
export interface RawFixture {
  entity: EntityTypeInfo['entity'];
  attributes: AttributeMetadata[];
  picklistAttributes: Array<{
    LogicalName: string;
    SchemaName: string;
    AttributeType: string;
    OptionSet: PicklistAttributeMetadata['OptionSet'];
    GlobalOptionSet: PicklistAttributeMetadata['GlobalOptionSet'];
  }>;
  formXml: string;
  formFields: string[];
}

/**
 * Load the raw fixture JSON (unparsed forms).
 */
export function loadRawFixture(): RawFixture {
  const raw = readFileSync(FIXTURE_PATH, 'utf-8');
  return JSON.parse(raw) as RawFixture;
}

/**
 * Load the fixture and build a complete EntityTypeInfo object.
 * This mirrors what the MetadataClient would return for a real entity.
 */
export function loadAccountEntityTypeInfo(): EntityTypeInfo {
  const fixture = loadRawFixture();

  const attributes: AttributeMetadata[] = fixture.attributes;

  // Build picklist attributes with proper typing
  const picklistAttributes: PicklistAttributeMetadata[] = fixture.picklistAttributes.map((p) => {
    const baseAttr = attributes.find((a) => a.LogicalName === p.LogicalName);
    return {
      ...(baseAttr || { LogicalName: p.LogicalName, SchemaName: p.SchemaName, AttributeType: p.AttributeType, DisplayName: { LocalizedLabels: [], UserLocalizedLabel: null }, IsPrimaryId: false, IsPrimaryName: false, RequiredLevel: { Value: 'None' }, IsValidForRead: true, IsValidForCreate: true, IsValidForUpdate: true, MetadataId: '' }),
      OptionSet: p.OptionSet,
      GlobalOptionSet: p.GlobalOptionSet,
    } as PicklistAttributeMetadata;
  });

  // Extract lookup attributes
  const lookupAttributes: LookupAttributeMetadata[] = attributes
    .filter((a) => a.AttributeType === 'Lookup' || a.AttributeType === 'Owner' || a.AttributeType === 'Customer')
    .map((a) => ({ ...a, Targets: [] }) as LookupAttributeMetadata);

  // Parse forms
  const parsedForms = fixture.formXml
    ? [parseForm({
        name: 'Account',
        formid: 'standard-account-form',
        formxml: fixture.formXml,
        description: null,
        isdefault: true,
      })]
    : [];

  return {
    entity: fixture.entity,
    attributes,
    picklistAttributes,
    multiSelectPicklistAttributes: [],
    lookupAttributes,
    statusAttributes: [] as StatusAttributeMetadata[],
    stateAttributes: [] as StateAttributeMetadata[],
    forms: parsedForms,
    oneToManyRelationships: [],
    manyToManyRelationships: [],
  };
}
