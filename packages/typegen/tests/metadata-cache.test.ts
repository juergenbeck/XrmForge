import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MetadataCache } from '../src/metadata/cache.js';
import { configureLogging, SilentLogSink, ConsoleLogSink, LogLevel } from '../src/logger.js';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { EntityTypeInfo, EntityMetadata } from '../src/metadata/types.js';

beforeEach(() => configureLogging({ sink: new SilentLogSink() }));
afterEach(() => configureLogging({ sink: new ConsoleLogSink(), minLevel: LogLevel.INFO }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ENV_URL = 'https://testorg.crm4.dynamics.com';

function createMockEntityTypeInfo(logicalName: string): EntityTypeInfo {
  const entity: EntityMetadata = {
    LogicalName: logicalName,
    SchemaName: logicalName.charAt(0).toUpperCase() + logicalName.slice(1),
    EntitySetName: `${logicalName}s`,
    DisplayName: { LocalizedLabels: [], UserLocalizedLabel: null },
    PrimaryIdAttribute: `${logicalName}id`,
    PrimaryNameAttribute: 'name',
    OwnershipType: 'UserOwned',
    IsCustomEntity: false,
    LogicalCollectionName: `${logicalName}s`,
    MetadataId: `meta-${logicalName}`,
  };

  return {
    entity,
    attributes: [],
    picklistAttributes: [],
    multiSelectPicklistAttributes: [],
    lookupAttributes: [],
    statusAttributes: [],
    forms: [],
    oneToManyRelationships: [],
    manyToOneRelationships: [],
    manyToManyRelationships: [],
  };
}

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xrmforge-cache-test-'));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

// ─── Save & Load ─────────────────────────────────────────────────────────────

describe('MetadataCache save and load', () => {
  it('should save and load metadata', async () => {
    const cache = new MetadataCache(tempDir);

    const entities = {
      account: createMockEntityTypeInfo('account'),
      contact: createMockEntityTypeInfo('contact'),
    };

    await cache.save(ENV_URL, entities, 'stamp-123');
    const loaded = await cache.load(ENV_URL);

    expect(loaded).not.toBeNull();
    expect(loaded!.manifest.entities).toEqual(['account', 'contact']);
    expect(loaded!.manifest.serverVersionStamp).toBe('stamp-123');
    expect(loaded!.entityTypeInfos.account!.entity.LogicalName).toBe('account');
    expect(loaded!.entityTypeInfos.contact!.entity.LogicalName).toBe('contact');
  });

  it('should return null when no cache exists', async () => {
    const cache = new MetadataCache(tempDir);
    const loaded = await cache.load(ENV_URL);
    expect(loaded).toBeNull();
  });

  it('should return null for different environment URL', async () => {
    const cache = new MetadataCache(tempDir);

    await cache.save(ENV_URL, { account: createMockEntityTypeInfo('account') }, 'stamp-1');
    const loaded = await cache.load('https://other.crm.dynamics.com');

    expect(loaded).toBeNull();
  });
});

// ─── Version Stamp ───────────────────────────────────────────────────────────

describe('MetadataCache version stamp', () => {
  it('should return stored version stamp', async () => {
    const cache = new MetadataCache(tempDir);

    await cache.save(ENV_URL, {}, 'my-version-stamp');
    const stamp = await cache.getVersionStamp(ENV_URL);

    expect(stamp).toBe('my-version-stamp');
  });

  it('should return null when no cache exists', async () => {
    const cache = new MetadataCache(tempDir);
    const stamp = await cache.getVersionStamp(ENV_URL);
    expect(stamp).toBeNull();
  });

  it('should handle null version stamp', async () => {
    const cache = new MetadataCache(tempDir);

    await cache.save(ENV_URL, {}, null);
    const stamp = await cache.getVersionStamp(ENV_URL);

    expect(stamp).toBeNull();
  });
});

// ─── Delta Updates ───────────────────────────────────────────────────────────

describe('MetadataCache delta updates', () => {
  it('should merge updated entities into existing cache', async () => {
    const cache = new MetadataCache(tempDir);

    // Initial save
    await cache.save(ENV_URL, {
      account: createMockEntityTypeInfo('account'),
      contact: createMockEntityTypeInfo('contact'),
    }, 'stamp-1');

    // Delta update: add lead, update contact
    await cache.updateEntities(ENV_URL, {
      contact: createMockEntityTypeInfo('contact'), // updated
      lead: createMockEntityTypeInfo('lead'),       // new
    }, 'stamp-2');

    const loaded = await cache.load(ENV_URL);
    expect(loaded!.manifest.entities).toEqual(['account', 'contact', 'lead']);
    expect(loaded!.manifest.serverVersionStamp).toBe('stamp-2');
  });

  it('should remove deleted entities', async () => {
    const cache = new MetadataCache(tempDir);

    await cache.save(ENV_URL, {
      account: createMockEntityTypeInfo('account'),
      contact: createMockEntityTypeInfo('contact'),
      lead: createMockEntityTypeInfo('lead'),
    }, 'stamp-1');

    await cache.removeEntities(ENV_URL, ['lead'], 'stamp-2');

    const loaded = await cache.load(ENV_URL);
    expect(loaded!.manifest.entities).toEqual(['account', 'contact']);
  });
});

// ─── Clear & Exists ──────────────────────────────────────────────────────────

describe('MetadataCache clear and exists', () => {
  it('should clear the cache', async () => {
    const cache = new MetadataCache(tempDir);

    await cache.save(ENV_URL, { account: createMockEntityTypeInfo('account') }, 'stamp');
    expect(await cache.exists()).toBe(true);

    await cache.clear();
    expect(await cache.exists()).toBe(false);
  });

  it('should not throw when clearing non-existent cache', async () => {
    const cache = new MetadataCache(tempDir);
    await expect(cache.clear()).resolves.not.toThrow();
  });
});
