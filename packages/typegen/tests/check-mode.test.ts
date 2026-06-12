/**
 * Drift Check Mode (OE-11, Release 2)
 *
 * generate --check runs the full generation in-memory and compares the
 * result byte-by-byte against outputDir WITHOUT writing anything.
 * These tests use the real file-writer against temp directories
 * (no file-writer mock) to verify the read-only guarantee.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { TypeGenerationOrchestrator } from '../src/orchestrator/orchestrator.js';
import { checkGeneratedFile, findOrphanedFiles } from '../src/orchestrator/file-writer.js';
import { createTempDir, cleanupTempDir } from './helpers/temp-dir.js';
import { configureLogging, SilentLogSink, ConsoleLogSink, LogLevel } from '../src/logger.js';
import type { TokenCredential, AccessToken } from '@azure/identity';
import type { EntityTypeInfo, AttributeMetadata, PicklistAttributeMetadata, OptionSetMetadata } from '../src/metadata/types.js';

// ─── Mocks (metadata comes from mocks, file IO is real) ─────────────────────

vi.mock('../src/metadata/client.js', () => ({
  MetadataClient: vi.fn().mockImplementation(() => ({
    getEntityTypeInfo: vi.fn(),
    getEntityNamesForSolutions: vi.fn().mockResolvedValue([]),
    getCustomApis: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../src/http/client.js', () => ({
  DataverseHttpClient: vi.fn().mockImplementation(() => ({})),
}));

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
      tabs: [{ name: 'General', sections: [{ name: 'General', controls: [{ id: 'name', datafieldname: 'name', classid: '' }], specialControls: [] }] }],
      allControls: [{ id: 'name', datafieldname: 'name', classid: '' }],
      allSpecialControls: [],
    }],
    oneToManyRelationships: [],
    manyToManyRelationships: [],
  };
}

function mockMetadataClient(): void {
  vi.mocked(MetadataClient).mockImplementation(() => ({
    getEntityTypeInfo: vi.fn().mockImplementation((name: string) => Promise.resolve(createMockEntityInfo(name))),
    getEntityNamesForSolutions: vi.fn().mockResolvedValue([]),
    getCustomApis: vi.fn().mockResolvedValue([]),
  }) as unknown as InstanceType<typeof MetadataClient>);
}

function createOrchestrator(outputDir: string, overrides: { checkOnly?: boolean; useCache?: boolean; cacheDir?: string } = {}): TypeGenerationOrchestrator {
  return new TypeGenerationOrchestrator(createMockCredential(), {
    environmentUrl: 'https://test.crm4.dynamics.com',
    entities: ['account'],
    outputDir,
    labelConfig: { primaryLanguage: 1033 },
    ...overrides,
  });
}

let tmpDir: string;

beforeEach(async () => {
  vi.clearAllMocks();
  mockMetadataClient();
  configureLogging({ sink: new SilentLogSink() });
  tmpDir = await createTempDir();
});

afterEach(async () => {
  configureLogging({ sink: new ConsoleLogSink(), minLevel: LogLevel.INFO });
  await cleanupTempDir(tmpDir);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('drift check mode (checkOnly)', () => {
  it('should report all files as missing for an empty output directory and write NOTHING', async () => {
    const result = await createOrchestrator(tmpDir, { checkOnly: true }).generate();

    expect(result.checkResult).toBeDefined();
    expect(result.checkResult!.drift).toBe(true);
    expect(result.checkResult!.unchanged).toBe(0);
    expect(result.checkResult!.findings.length).toBe(result.totalFiles);
    expect(result.checkResult!.findings.every((f) => f.status === 'missing')).toBe(true);

    // Read-only guarantee: the output directory must remain empty
    const entries = await fs.readdir(tmpDir);
    expect(entries).toEqual([]);
  });

  it('should pass directly after a regular generate run (no drift)', async () => {
    const writeResult = await createOrchestrator(tmpDir).generate();
    expect(writeResult.totalFiles).toBeGreaterThan(0);

    const result = await createOrchestrator(tmpDir, { checkOnly: true }).generate();

    expect(result.checkResult!.drift).toBe(false);
    expect(result.checkResult!.findings).toEqual([]);
    expect(result.checkResult!.unchanged).toBe(result.totalFiles);
  });

  it('should detect a changed file (including manual edits to the generated output)', async () => {
    await createOrchestrator(tmpDir).generate();

    // Simulate drift / manual patch: modify a checked-in generated file
    const target = path.join(tmpDir, 'entities', 'account.ts');
    await fs.appendFile(target, '\n// manual patch\n', 'utf-8');

    const result = await createOrchestrator(tmpDir, { checkOnly: true }).generate();

    expect(result.checkResult!.drift).toBe(true);
    expect(result.checkResult!.findings).toEqual([
      { relativePath: 'entities/account.ts', type: 'entity', status: 'changed' },
    ]);

    // Read-only guarantee: the manual edit must survive the check
    const content = await fs.readFile(target, 'utf-8');
    expect(content).toContain('// manual patch');
  });

  it('should detect orphaned files (objects deleted in Dataverse)', async () => {
    await createOrchestrator(tmpDir).generate();
    await fs.writeFile(path.join(tmpDir, 'entities', 'deletedentity.ts'), 'stale', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'forms', 'deletedentity.ts'), 'stale', 'utf-8');

    const result = await createOrchestrator(tmpDir, { checkOnly: true }).generate();

    expect(result.checkResult!.drift).toBe(true);
    expect(result.checkResult!.findings).toEqual([
      { relativePath: 'entities/deletedentity.ts', type: 'entity', status: 'orphaned' },
      { relativePath: 'forms/deletedentity.ts', type: 'form', status: 'orphaned' },
    ]);

    // Read-only guarantee: orphans are reported, never deleted
    await expect(fs.access(path.join(tmpDir, 'entities', 'deletedentity.ts'))).resolves.toBeUndefined();
  });

  it('should ignore the metadata cache in check mode (no cache reads or writes)', async () => {
    await createOrchestrator(tmpDir).generate();

    const cacheDir = path.join(tmpDir, '.xrmforge-cache');
    const result = await createOrchestrator(tmpDir, { checkOnly: true, useCache: true, cacheDir }).generate();

    expect(result.checkResult!.drift).toBe(false);
    // No cache directory may be created by a read-only check
    await expect(fs.access(cacheDir)).rejects.toThrow();
  });

  it('should skip the check result when entity fetching fails (error, not drift)', async () => {
    vi.mocked(MetadataClient).mockImplementation(() => ({
      getEntityTypeInfo: vi.fn().mockRejectedValue(new Error('Entity not found')),
      getEntityNamesForSolutions: vi.fn().mockResolvedValue([]),
      getCustomApis: vi.fn().mockResolvedValue([]),
    }) as unknown as InstanceType<typeof MetadataClient>);

    const result = await createOrchestrator(tmpDir, { checkOnly: true }).generate();

    expect(result.checkResult).toBeUndefined();
    expect(result.entities[0]!.warnings.length).toBeGreaterThan(0);

    // Still read-only on failure
    const entries = await fs.readdir(tmpDir);
    expect(entries).toEqual([]);
  });
});

// ─── file-writer check helpers ───────────────────────────────────────────────

describe('checkGeneratedFile', () => {
  it('should distinguish unchanged, changed, and missing', async () => {
    const file = { relativePath: 'entities/account.ts', content: 'content-a', type: 'entity' as const };

    expect(await checkGeneratedFile(tmpDir, file)).toBe('missing');

    await fs.mkdir(path.join(tmpDir, 'entities'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'entities', 'account.ts'), 'content-a', 'utf-8');
    expect(await checkGeneratedFile(tmpDir, file)).toBe('unchanged');

    await fs.writeFile(path.join(tmpDir, 'entities', 'account.ts'), 'content-b', 'utf-8');
    expect(await checkGeneratedFile(tmpDir, file)).toBe('changed');
  });
});

describe('findOrphanedFiles', () => {
  it('should only scan known generated locations and .ts files', async () => {
    await fs.mkdir(path.join(tmpDir, 'entities'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'userstuff'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'entities', 'expected.ts'), 'x', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'entities', 'orphan.ts'), 'x', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'entities', 'notes.md'), 'x', 'utf-8');         // not .ts: ignored
    await fs.writeFile(path.join(tmpDir, 'userstuff', 'custom.ts'), 'x', 'utf-8');       // outside scope: ignored
    await fs.writeFile(path.join(tmpDir, 'index.ts'), 'x', 'utf-8');                     // known root file

    const orphans = await findOrphanedFiles(tmpDir, new Set(['entities/expected.ts', 'index.ts']));

    expect(orphans).toEqual(['entities/orphan.ts']);
  });

  it('should report known root files as orphaned when no longer expected', async () => {
    await fs.writeFile(path.join(tmpDir, 'form-mapping.json'), '{}', 'utf-8');

    const orphans = await findOrphanedFiles(tmpDir, new Set());

    expect(orphans).toEqual(['form-mapping.json']);
  });
});
