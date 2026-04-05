import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TypeGenerationOrchestrator } from '../src/orchestrator/orchestrator.js';
import type { TokenCredential, AccessToken } from '@azure/identity';
import type { EntityTypeInfo, AttributeMetadata, PicklistAttributeMetadata, OptionSetMetadata } from '../src/metadata/types.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock the MetadataClient module
vi.mock('../src/metadata/client.js', () => ({
  MetadataClient: vi.fn().mockImplementation(() => ({
    getEntityTypeInfo: vi.fn(),
    getEntityNamesForSolutions: vi.fn().mockResolvedValue([]),
    getCustomApis: vi.fn().mockResolvedValue([]),
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
    writeAllFiles: vi.fn().mockResolvedValue({ written: 3, unchanged: 0, warnings: [] }),
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
    expect(paths).toContain('entities/contact.ts');
    expect(paths).toContain('optionsets/contact.ts');
    expect(paths).toContain('forms/contact.ts');
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

  it('should accept useCache=true without throwing', () => {
    const credential = createMockCredential();

    expect(() => new TypeGenerationOrchestrator(credential, {
      environmentUrl: 'https://test.crm4.dynamics.com',
      entities: ['account'],
      outputDir: './typings',
      labelConfig: { primaryLanguage: 1033 },
      useCache: true,
    })).not.toThrow();
  });

  it('should not throw when useCache is false or omitted', () => {
    const credential = createMockCredential();

    // Explicitly false
    expect(() => new TypeGenerationOrchestrator(credential, {
      environmentUrl: 'https://test.crm4.dynamics.com',
      entities: ['account'],
      outputDir: './typings',
      labelConfig: { primaryLanguage: 1033 },
      useCache: false,
    })).not.toThrow();

    // Omitted (default)
    expect(() => new TypeGenerationOrchestrator(credential, {
      environmentUrl: 'https://test.crm4.dynamics.com',
      entities: ['account'],
      outputDir: './typings',
      labelConfig: { primaryLanguage: 1033 },
    })).not.toThrow();
  });

  it('should return empty result when aborted before start', async () => {
    const credential = createMockCredential();

    const mockGetEntityTypeInfo = vi.fn().mockResolvedValue(createMockEntityInfo('account'));
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

    // Create an already-aborted signal
    const controller = new AbortController();
    controller.abort();

    const result = await orchestrator.generate({ signal: controller.signal });

    expect(result.entities).toHaveLength(0);
    expect(result.totalFiles).toBe(0);
    // MetadataClient should never have been called
    expect(mockGetEntityTypeInfo).not.toHaveBeenCalled();
  });

  it('should process multiple entities in parallel (R7-04)', async () => {
    const credential = createMockCredential();
    const mockAccountInfo = createMockEntityInfo('account');
    const mockContactInfo = createMockEntityInfo('contact');

    const mockGetEntityTypeInfo = vi.fn()
      .mockImplementation((name: string) => {
        if (name === 'account') return Promise.resolve(mockAccountInfo);
        if (name === 'contact') return Promise.resolve(mockContactInfo);
        return Promise.reject(new Error('Unknown entity'));
      });

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
      entities: ['account', 'contact'],
      outputDir: './typings',
      labelConfig: { primaryLanguage: 1033 },
    });

    const result = await orchestrator.generate();

    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].entityLogicalName).toBe('account');
    expect(result.entities[1].entityLogicalName).toBe('contact');
    expect(mockGetEntityTypeInfo).toHaveBeenCalledTimes(2);
  });

  it('should handle partial failure in parallel processing (R7-04)', async () => {
    const credential = createMockCredential();
    const mockAccountInfo = createMockEntityInfo('account');

    const mockGetEntityTypeInfo = vi.fn()
      .mockImplementation((name: string) => {
        if (name === 'account') return Promise.resolve(mockAccountInfo);
        return Promise.reject(new Error('Entity not found: badentity'));
      });

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
      entities: ['account', 'badentity'],
      outputDir: './typings',
      labelConfig: { primaryLanguage: 1033 },
    });

    const result = await orchestrator.generate();

    // Account should succeed
    expect(result.entities[0].entityLogicalName).toBe('account');
    expect(result.entities[0].files.length).toBeGreaterThan(0);

    // badentity should fail gracefully
    expect(result.entities[1].entityLogicalName).toBe('badentity');
    expect(result.entities[1].files).toHaveLength(0);
    expect(result.entities[1].warnings[0]).toContain('Entity not found');
  });

  it('should resolve entities from solutionNames', async () => {
    const credential = createMockCredential();
    const mockAccountInfo = createMockEntityInfo('account');

    const mockGetEntityTypeInfo = vi.fn().mockResolvedValue(mockAccountInfo);
    const mockGetEntityNamesForSolutions = vi.fn().mockResolvedValue(['account', 'contact']);

    vi.mocked(MetadataClient).mockImplementation(() => ({
      getEntityTypeInfo: mockGetEntityTypeInfo,
      getEntityNamesForSolutions: mockGetEntityNamesForSolutions,
      getCustomApis: vi.fn().mockResolvedValue([]),
      getEntityWithAttributes: vi.fn(),
      getEntityAttributes: vi.fn(),
      getEntityForms: vi.fn(),
      getGlobalOptionSets: vi.fn(),
      getSolutionEntities: vi.fn(),
    }) as unknown as InstanceType<typeof MetadataClient>);

    const orchestrator = new TypeGenerationOrchestrator(credential, {
      environmentUrl: 'https://test.crm4.dynamics.com',
      entities: [],
      solutionNames: ['MySolution'],
      outputDir: './typings',
      labelConfig: { primaryLanguage: 1033 },
    });

    const result = await orchestrator.generate();

    expect(mockGetEntityNamesForSolutions).toHaveBeenCalledWith(['MySolution']);
    expect(result.entities).toHaveLength(2);
  });

  it('should return warning when no entities after resolution', async () => {
    const credential = createMockCredential();

    const mockGetEntityNamesForSolutions = vi.fn().mockResolvedValue([]);

    vi.mocked(MetadataClient).mockImplementation(() => ({
      getEntityTypeInfo: vi.fn(),
      getEntityNamesForSolutions: mockGetEntityNamesForSolutions,
      getCustomApis: vi.fn().mockResolvedValue([]),
      getEntityWithAttributes: vi.fn(),
      getEntityAttributes: vi.fn(),
      getEntityForms: vi.fn(),
      getGlobalOptionSets: vi.fn(),
      getSolutionEntities: vi.fn(),
    }) as unknown as InstanceType<typeof MetadataClient>);

    const orchestrator = new TypeGenerationOrchestrator(credential, {
      environmentUrl: 'https://test.crm4.dynamics.com',
      entities: [],
      outputDir: './typings',
      labelConfig: { primaryLanguage: 1033 },
    });

    const result = await orchestrator.generate();

    expect(result.entities).toHaveLength(0);
    expect(result.totalWarnings).toBe(1);
  });

  it('should generate Custom API action files when generateActions=true', async () => {
    const credential = createMockCredential();
    const mockAccountInfo = createMockEntityInfo('account');

    const mockCustomApis = [{
      api: { uniquename: 'markant_testaction', name: 'TestAction', isfunction: false, isprivate: false, bindingtype: 0, boundentitylogicalname: null },
      requestParameters: [],
      responseProperties: [],
    }];

    vi.mocked(MetadataClient).mockImplementation(() => ({
      getEntityTypeInfo: vi.fn().mockResolvedValue(mockAccountInfo),
      getEntityNamesForSolutions: vi.fn().mockResolvedValue([]),
      getCustomApis: vi.fn().mockResolvedValue(mockCustomApis),
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
      generateActions: true,
    });

    const result = await orchestrator.generate();

    const allFiles = result.entities.flatMap((e) => e.files);
    // The action files are in the top-level totalFiles count
    expect(result.totalFiles).toBeGreaterThan(allFiles.length);
  });

  it('should filter Custom APIs by actionsFilter prefix', async () => {
    const credential = createMockCredential();
    const mockAccountInfo = createMockEntityInfo('account');

    const mockCustomApis = [
      { api: { uniquename: 'markant_myaction', name: 'MyAction', isfunction: false, isprivate: false, bindingtype: 0, boundentitylogicalname: null }, requestParameters: [], responseProperties: [] },
      { api: { uniquename: 'other_action', name: 'OtherAction', isfunction: false, isprivate: false, bindingtype: 0, boundentitylogicalname: null }, requestParameters: [], responseProperties: [] },
    ];

    vi.mocked(MetadataClient).mockImplementation(() => ({
      getEntityTypeInfo: vi.fn().mockResolvedValue(mockAccountInfo),
      getEntityNamesForSolutions: vi.fn().mockResolvedValue([]),
      getCustomApis: vi.fn().mockResolvedValue(mockCustomApis),
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
      generateActions: true,
      actionsFilter: 'markant_',
    });

    const result = await orchestrator.generate();

    // Should filter to only 1 action (markant_ prefix)
    expect(result.totalFiles).toBeGreaterThan(0);
  });

  it('should respect generateForms=false and generateOptionSets=false', async () => {
    const credential = createMockCredential();
    const mockEntityInfo = createMockEntityInfo('account');

    vi.mocked(MetadataClient).mockImplementation(() => ({
      getEntityTypeInfo: vi.fn().mockResolvedValue(mockEntityInfo),
      getEntityNamesForSolutions: vi.fn().mockResolvedValue([]),
      getCustomApis: vi.fn().mockResolvedValue([]),
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
      generateForms: false,
      generateOptionSets: false,
    });

    const result = await orchestrator.generate();

    const fileTypes = result.entities[0].files.map((f) => f.type);
    expect(fileTypes).toContain('entity');
    expect(fileTypes).not.toContain('form');
    expect(fileTypes).not.toContain('optionset');
  });

  it('should generate EntityNames enum file', async () => {
    const credential = createMockCredential();
    const mockEntityInfo = createMockEntityInfo('account');

    vi.mocked(MetadataClient).mockImplementation(() => ({
      getEntityTypeInfo: vi.fn().mockResolvedValue(mockEntityInfo),
      getEntityNamesForSolutions: vi.fn().mockResolvedValue([]),
      getCustomApis: vi.fn().mockResolvedValue([]),
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

    // totalFiles includes entity-names.d.ts and index.d.ts on top of entity files
    expect(result.totalFiles).toBeGreaterThan(result.entities[0].files.length);
  });
});
