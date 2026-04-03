/**
 * Tests for MetadataCache and deleteOrphanedFiles.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { MetadataCache } from '../src/metadata/cache.js';
import { deleteOrphanedFiles } from '../src/orchestrator/file-writer.js';
import { configureLogging, SilentLogSink, ConsoleLogSink, LogLevel } from '../src/logger.js';
import type { EntityTypeInfo } from '../src/metadata/types.js';

beforeEach(() => configureLogging({ sink: new SilentLogSink() }));
afterEach(() => configureLogging({ sink: new ConsoleLogSink(), minLevel: LogLevel.INFO }));

function createMinimalEntityInfo(entityName: string): EntityTypeInfo {
  return {
    entityLogicalName: entityName,
    entityMetadata: {
      LogicalName: entityName,
      SchemaName: entityName.charAt(0).toUpperCase() + entityName.slice(1),
      DisplayName: { LocalizedLabels: [{ Label: entityName, LanguageCode: 1033 }] },
      EntitySetName: entityName + 's',
      MetadataId: `meta-${entityName}`,
      PrimaryIdAttribute: entityName + 'id',
      PrimaryNameAttribute: 'name',
    },
    attributes: [],
    lookupAttributes: [],
    picklistAttributes: [],
    stateAttributes: [],
    statusAttributes: [],
    oneToManyRelationships: [],
    manyToManyRelationships: [],
    forms: [],
  } as unknown as EntityTypeInfo;
}

describe('MetadataCache', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xrmforge-cache-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should return null when no cache exists', async () => {
    const cache = new MetadataCache(tmpDir);
    const result = await cache.load('https://test.crm4.dynamics.com');
    expect(result).toBeNull();
  });

  it('should save and load metadata', async () => {
    const cache = new MetadataCache(tmpDir);
    const envUrl = 'https://test.crm4.dynamics.com';

    const entities: Record<string, EntityTypeInfo> = {
      account: createMinimalEntityInfo('account'),
      contact: createMinimalEntityInfo('contact'),
    };

    await cache.save(envUrl, entities, 'stamp-123');
    const loaded = await cache.load(envUrl);

    expect(loaded).not.toBeNull();
    expect(loaded!.manifest.serverVersionStamp).toBe('stamp-123');
    expect(loaded!.manifest.entities).toEqual(['account', 'contact']);
    expect(loaded!.entityTypeInfos['account']).toBeDefined();
    expect(loaded!.entityTypeInfos['contact']).toBeDefined();
  });

  it('should return null for different environment URL', async () => {
    const cache = new MetadataCache(tmpDir);

    await cache.save('https://org-a.crm4.dynamics.com', {
      account: createMinimalEntityInfo('account'),
    }, 'stamp-1');

    const loaded = await cache.load('https://org-b.crm4.dynamics.com');
    expect(loaded).toBeNull();
  });

  it('should get version stamp', async () => {
    const cache = new MetadataCache(tmpDir);
    const envUrl = 'https://test.crm4.dynamics.com';

    await cache.save(envUrl, {}, 'my-stamp-456');
    const stamp = await cache.getVersionStamp(envUrl);
    expect(stamp).toBe('my-stamp-456');
  });

  it('should return null version stamp when no cache', async () => {
    const cache = new MetadataCache(tmpDir);
    const stamp = await cache.getVersionStamp('https://test.crm4.dynamics.com');
    expect(stamp).toBeNull();
  });

  it('should update entities (delta update)', async () => {
    const cache = new MetadataCache(tmpDir);
    const envUrl = 'https://test.crm4.dynamics.com';

    // Initial save with account
    await cache.save(envUrl, {
      account: createMinimalEntityInfo('account'),
    }, 'stamp-1');

    // Delta update: add contact
    await cache.updateEntities(envUrl, {
      contact: createMinimalEntityInfo('contact'),
    }, 'stamp-2');

    const loaded = await cache.load(envUrl);
    expect(loaded!.manifest.serverVersionStamp).toBe('stamp-2');
    expect(loaded!.manifest.entities).toContain('account');
    expect(loaded!.manifest.entities).toContain('contact');
  });

  it('should remove entities', async () => {
    const cache = new MetadataCache(tmpDir);
    const envUrl = 'https://test.crm4.dynamics.com';

    await cache.save(envUrl, {
      account: createMinimalEntityInfo('account'),
      contact: createMinimalEntityInfo('contact'),
    }, 'stamp-1');

    await cache.removeEntities(envUrl, ['contact'], 'stamp-2');

    const loaded = await cache.load(envUrl);
    expect(loaded!.manifest.entities).toEqual(['account']);
    expect(loaded!.entityTypeInfos['contact']).toBeUndefined();
  });

  it('should clear the cache', async () => {
    const cache = new MetadataCache(tmpDir);
    const envUrl = 'https://test.crm4.dynamics.com';

    await cache.save(envUrl, {
      account: createMinimalEntityInfo('account'),
    }, 'stamp-1');

    expect(await cache.exists()).toBe(true);
    await cache.clear();
    expect(await cache.exists()).toBe(false);
  });

  it('should handle corrupt cache gracefully (returns null)', async () => {
    const cache = new MetadataCache(tmpDir);
    const cacheFile = path.join(tmpDir, 'metadata.json');

    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(cacheFile, '{ corrupt json !!!', 'utf-8');

    const loaded = await cache.load('https://test.crm4.dynamics.com');
    expect(loaded).toBeNull();
  });

  it('should resolve relative paths from cwd', () => {
    // Default constructor uses relative path
    const cache = new MetadataCache();
    // Should not throw
    expect(cache).toBeDefined();
  });
});

describe('deleteOrphanedFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xrmforge-orphan-test-'));
    // Create directory structure
    await fs.mkdir(path.join(tmpDir, 'entities'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'optionsets'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'forms'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should delete entity, optionset, and form files for deleted entities', async () => {
    // Create files for an entity
    await fs.writeFile(path.join(tmpDir, 'entities', 'obsolete.d.ts'), 'content', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'optionsets', 'obsolete.d.ts'), 'content', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'forms', 'obsolete.d.ts'), 'content', 'utf-8');

    const deleted = await deleteOrphanedFiles(tmpDir, ['obsolete']);
    expect(deleted).toBe(3);

    // Verify files are gone
    await expect(fs.access(path.join(tmpDir, 'entities', 'obsolete.d.ts'))).rejects.toThrow();
    await expect(fs.access(path.join(tmpDir, 'optionsets', 'obsolete.d.ts'))).rejects.toThrow();
    await expect(fs.access(path.join(tmpDir, 'forms', 'obsolete.d.ts'))).rejects.toThrow();
  });

  it('should not fail when files do not exist', async () => {
    const deleted = await deleteOrphanedFiles(tmpDir, ['nonexistent']);
    expect(deleted).toBe(0);
  });

  it('should not touch files of other entities', async () => {
    await fs.writeFile(path.join(tmpDir, 'entities', 'account.d.ts'), 'keep', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'entities', 'obsolete.d.ts'), 'delete', 'utf-8');

    await deleteOrphanedFiles(tmpDir, ['obsolete']);

    const accountContent = await fs.readFile(path.join(tmpDir, 'entities', 'account.d.ts'), 'utf-8');
    expect(accountContent).toBe('keep');
  });
});
