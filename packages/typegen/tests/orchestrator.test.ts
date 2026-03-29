import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TypeGenerationOrchestrator } from '../src/orchestrator/orchestrator.js';
import type { TokenCredential, AccessToken } from '@azure/identity';
import type { EntityTypeInfo, AttributeMetadata, PicklistAttributeMetadata, OptionSetMetadata } from '../src/metadata/types.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock the MetadataClient module
vi.mock('../src/metadata/client.js', () => ({
  MetadataClient: vi.fn().mockImplementation(() => ({
    getEntityTypeInfo: vi.fn(),
  })),
}));

// Mock the HTTP client module
vi.mock('../src/http/client.js', () => ({
  DataverseHttpClient: vi.fn().mockImplementation(() => ({})),
}));

// Mock the file-writer to avoid disk I/O in tests
vi.mock('../src/orchestrator/file-writer.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/orchestrator/file-writer.js')>();
  return {
    ...original,
    writeAllFiles: vi.fn().mockResolvedValue(3),
  };
});

import { MetadataClient } from '../src/metadata/client.js';

function createMockCredential(): TokenCredential {
  return {
    getToken: vi.fn().mockResolvedValue({ token: 'mock-token', expiresOnTimestamp: Date.now() + 3600000 } as AccessToken),
  };
}

function createMockEntityInfo(entityName: string): EntityTypeInfo {
  const attr: AttributeMetadata = {
    LogicalName: 'name',
    SchemaName: 'Name',
    AttributeType: 'String',
    DisplayName: { LocalizedLabels: [{ Label: 'Name', LanguageCode: 1033 }], UserLocalizedLabel: null },
    IsPrimaryId: false,
    IsPrimaryName: true,
    RequiredLevel: { Value: 'Required' },
    IsValidForRead: true,
    IsValidForCreate: true,
    IsValidForUpdate: true,
    MetadataId: 'attr-1',
  };

  const optionSet: OptionSetMetadata = {
    Name: 'statuscode',
    DisplayName: { LocalizedLabels: [{ Label: 'Status', LanguageCode: 1033 }], UserLocalizedLabel: null },
    IsCustomOptionSet: false,
    IsGlobal: false,
    OptionSetType: 'Picklist',
    Options: [
      { Value: 1, Label: { LocalizedLabels: [{ Label: 'Active', LanguageCode: 1033 }], UserLocalizedLabel: null }, Description: { LocalizedLabels: [], UserLocalizedLabel: null }, Color: null },
    ],
    MetadataId: 'os-1',
  };

  const picklistAttr: PicklistAttributeMetadata = {
    ...attr,
    LogicalName: 'statuscode',
    SchemaName: 'StatusCode',
    AttributeType: 'Status',
    OptionSet: optionSet,
    GlobalOptionSet: null,
  };

  return {
    entity: {
      LogicalName: entityName,
      SchemaName: entityName.charAt(0).toUpperCase() + entityName.slice(1),
      EntitySetName: entityName + 's',
      DisplayName: { LocalizedLabels: [{ Label: entityName, LanguageCode: 1033 }], UserLocalizedLabel: null },
      PrimaryIdAttribute: entityName + 'id',
      PrimaryNameAttribute: 'name',
      OwnershipType: 'UserOwned',
      IsCustomEntity: false,
      LogicalCollectionName: entityName + 's',
      MetadataId: 'entity-1',
    },
    attributes: [attr],
    picklistAttributes: [picklistAttr],
    lookupAttributes: [],
    statusAttributes: [],
    stateAttributes: [],
    forms: [{
      name: 'Information',
      formId: 'form-1',
      isDefault: true,
      tabs: [{ name: 'General', sections: [{ name: 'General', controls: [{ id: 'name', datafieldname: 'name', classid: '' }] }] }],
      allControls: [{ id: 'name', datafieldname: 'name', classid: '' }],
    }],
    oneToManyRelationships: [],
    manyToManyRelationships: [],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TypeGenerationOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create an orchestrator with default config', () => {
    const credential = createMockCredential();
    const orchestrator = new TypeGenerationOrchestrator(credential, {
      environmentUrl: 'https://test.crm4.dynamics.com',
      entities: ['account'],
      outputDir: './typings',
      labelConfig: { primaryLanguage: 1033 },
    });

    expect(orchestrator).toBeDefined();
  });

  it('should generate files for each entity', async () => {
    const credential = createMockCredential();
    const mockEntityInfo = createMockEntityInfo('account');

    // Setup MetadataClient mock to return entity info
    const mockGetEntityTypeInfo = vi.fn().mockResolvedValue(mockEntityInfo);
    vi.mocked(MetadataClient).mockImplementation(() => ({
      getEntityTypeInfo: mockGetEntityTypeInfo,
      getEntityWithAttributes: vi.fn(),
      getEntityAttributes: vi.fn(),
      getEntityForms: vi.fn(),
      getGlobalOptionSets: vi.fn(),
      getSolutionEntities: vi.fn(),
    }) as unknown as InstanceType<typeof MetadataClient>);

    const orchestrator = new TypeGenerationOrchestrator(credential, {
      environmentUrl: 'https://test.crm4.dynamics.com',
      entities: ['account'],
      outputDir: './typings',
      labelConfig: { primaryLanguage: 1033 },
    });

    const result = await orchestrator.generate();

    // Should have processed one entity
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].entityLogicalName).toBe('account');

    // Should have generated entity + optionset + form files
    expect(result.entities[0].files.length).toBeGreaterThanOrEqual(2);

    // Check file types
    const fileTypes = result.entities[0].files.map((f) => f.type);
    expect(fileTypes).toContain('entity');
    expect(fileTypes).toContain('optionset');
    expect(fileTypes).toContain('form');
  });

  it('should generate correct file paths', async () => {
    const credential = createMockCredential();
    const mockEntityInfo = createMockEntityInfo('contact');

    const mockGetEntityTypeInfo = vi.fn().mockResolvedValue(mockEntityInfo);
    vi.mocked(MetadataClient).mockImplementation(() => ({
      getEntityTypeInfo: mockGetEntityTypeInfo,
      getEntityWithAttributes: vi.fn(),
      getEntityAttributes: vi.fn(),
      getEntityForms: vi.fn(),
      getGlobalOptionSets: vi.fn(),
      getSolutionEntities: vi.fn(),
    }) as unknown as InstanceType<typeof MetadataClient>);

    const orchestrator = new TypeGenerationOrchestrator(credential, {
      environmentUrl: 'https://test.crm4.dynamics.com',
      entities: ['contact'],
      outputDir: './typings',
      labelConfig: { primaryLanguage: 1033 },
    });

    const result = await orchestrator.generate();

    const paths = result.entities[0].files.map((f) => f.relativePath);
    expect(paths).toContain('entities/contact.d.ts');
    expect(paths).toContain('optionsets/contact.d.ts');
    expect(paths).toContain('forms/contact.d.ts');
  });

  it('should handle errors gracefully', async () => {
    const credential = createMockCredential();

    const mockGetEntityTypeInfo = vi.fn().mockRejectedValue(new Error('Entity not found'));
    vi.mocked(MetadataClient).mockImplementation(() => ({
      getEntityTypeInfo: mockGetEntityTypeInfo,
      getEntityWithAttributes: vi.fn(),
      getEntityAttributes: vi.fn(),
      getEntityForms: vi.fn(),
      getGlobalOptionSets: vi.fn(),
      getSolutionEntities: vi.fn(),
    }) as unknown as InstanceType<typeof MetadataClient>);

    const orchestrator = new TypeGenerationOrchestrator(credential, {
      environmentUrl: 'https://test.crm4.dynamics.com',
      entities: ['nonexistent'],
      outputDir: './typings',
      labelConfig: { primaryLanguage: 1033 },
    });

    const result = await orchestrator.generate();

    // Should not throw, but record warning
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].files).toHaveLength(0);
    expect(result.entities[0].warnings.length).toBeGreaterThan(0);
    expect(result.entities[0].warnings[0]).toContain('Entity not found');
  });

  it('should respect generateEntities=false', async () => {
    const credential = createMockCredential();
    const mockEntityInfo = createMockEntityInfo('account');

    const mockGetEntityTypeInfo = vi.fn().mockResolvedValue(mockEntityInfo);
    vi.mocked(MetadataClient).mockImplementation(() => ({
      getEntityTypeInfo: mockGetEntityTypeInfo,
      getEntityWithAttributes: vi.fn(),
      getEntityAttributes: vi.fn(),
      getEntityForms: vi.fn(),
      getGlobalOptionSets: vi.fn(),
      getSolutionEntities: vi.fn(),
    }) as unknown as InstanceType<typeof MetadataClient>);

    const orchestrator = new TypeGenerationOrchestrator(credential, {
      environmentUrl: 'https://test.crm4.dynamics.com',
      entities: ['account'],
      outputDir: './typings',
      labelConfig: { primaryLanguage: 1033 },
      generateEntities: false,
    });

    const result = await orchestrator.generate();

    const fileTypes = result.entities[0].files.map((f) => f.type);
    expect(fileTypes).not.toContain('entity');
    expect(fileTypes).toContain('optionset');
    expect(fileTypes).toContain('form');
  });

  it('should include generated header in all files', async () => {
    const credential = createMockCredential();
    const mockEntityInfo = createMockEntityInfo('account');

    const mockGetEntityTypeInfo = vi.fn().mockResolvedValue(mockEntityInfo);
    vi.mocked(MetadataClient).mockImplementation(() => ({
      getEntityTypeInfo: mockGetEntityTypeInfo,
      getEntityWithAttributes: vi.fn(),
      getEntityAttributes: vi.fn(),
      getEntityForms: vi.fn(),
      getGlobalOptionSets: vi.fn(),
      getSolutionEntities: vi.fn(),
    }) as unknown as InstanceType<typeof MetadataClient>);

    const orchestrator = new TypeGenerationOrchestrator(credential, {
      environmentUrl: 'https://test.crm4.dynamics.com',
      entities: ['account'],
      outputDir: './typings',
      labelConfig: { primaryLanguage: 1033 },
    });

    const result = await orchestrator.generate();

    for (const file of result.entities[0].files) {
      expect(file.content).toContain('@xrmforge/typegen');
      expect(file.content).toContain('Do not edit manually');
    }
  });
});
