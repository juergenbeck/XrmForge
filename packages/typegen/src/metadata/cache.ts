/**
 * @xrmforge/typegen - Metadata Cache
 *
 * File-system based metadata cache using Dataverse's RetrieveMetadataChanges
 * ServerVersionStamp for efficient delta detection.
 *
 * On first run: full metadata retrieval, saved to .xrmforge/cache/metadata.json
 * On subsequent runs: delta query with stored VersionStamp, only changed entities refreshed
 * On expired stamp (90-day window or system maintenance): automatic full reload
 *
 * @see https://learn.microsoft.com/en-us/power-apps/developer/data-platform/cache-schema-data
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { createLogger } from '../logger.js';
import type { EntityTypeInfo } from './types.js';

const log = createLogger('cache');

// ─── Cache Structure ─────────────────────────────────────────────────────────

interface CacheManifest {
  /** XrmForge version that created this cache */
  version: string;
  /** Dataverse environment URL */
  environmentUrl: string;
  /** ServerVersionStamp from last RetrieveMetadataChanges call */
  serverVersionStamp: string | null;
  /** ISO timestamp of last full or delta refresh */
  lastRefreshed: string;
  /** Entity logical names in this cache */
  entities: string[];
}

interface CacheData {
  manifest: CacheManifest;
  entityTypeInfos: Record<string, EntityTypeInfo>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CACHE_DIR = '.xrmforge/cache';
const CACHE_FILE = 'metadata.json';
const CACHE_VERSION = '1';

// ─── Cache Manager ───────────────────────────────────────────────────────────

export class MetadataCache {
  private readonly cacheDir: string;
  private readonly cacheFilePath: string;

  /**
   * @param cacheDir - Directory where cache files are stored.
   *   Can be an absolute path or relative to cwd.
   *   Defaults to ".xrmforge/cache" when constructed without argument.
   */
  constructor(cacheDir: string = CACHE_DIR) {
    this.cacheDir = path.resolve(cacheDir);
    this.cacheFilePath = path.join(this.cacheDir, CACHE_FILE);
  }

  /**
   * Load cached metadata from disk.
   * Returns null if no cache exists, cache is for a different environment,
   * or cache format is incompatible.
   */
  async load(environmentUrl: string): Promise<CacheData | null> {
    try {
      const raw = await fs.readFile(this.cacheFilePath, 'utf-8');
      const data = JSON.parse(raw) as CacheData;

      // Validate cache compatibility
      if (data.manifest.version !== CACHE_VERSION) {
        log.info('Cache version mismatch, will do full refresh');
        return null;
      }

      if (data.manifest.environmentUrl !== environmentUrl) {
        log.info('Cache is for a different environment, will do full refresh', {
          cached: data.manifest.environmentUrl,
          current: environmentUrl,
        });
        return null;
      }

      log.info(`Loaded metadata cache: ${data.manifest.entities.length} entities, ` +
        `last refreshed ${data.manifest.lastRefreshed}`);

      return data;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        log.info('No metadata cache found, will do full refresh');
      } else {
        log.warn('Failed to read metadata cache, will do full refresh', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return null;
    }
  }

  /**
   * Save metadata to the file-system cache.
   */
  async save(
    environmentUrl: string,
    entityTypeInfos: Record<string, EntityTypeInfo>,
    serverVersionStamp: string | null,
  ): Promise<void> {
    const data: CacheData = {
      manifest: {
        version: CACHE_VERSION,
        environmentUrl,
        serverVersionStamp,
        lastRefreshed: new Date().toISOString(),
        entities: Object.keys(entityTypeInfos).sort(),
      },
      entityTypeInfos,
    };

    await fs.mkdir(this.cacheDir, { recursive: true });

    // Atomic write: write to temp file, then rename (prevents corrupt cache on crash)
    const tmpPath = this.cacheFilePath + '.tmp';
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tmpPath, this.cacheFilePath);

    log.info(`Saved metadata cache: ${data.manifest.entities.length} entities`);
  }

  /**
   * Get the stored ServerVersionStamp for delta queries.
   * Returns null if no cache exists.
   */
  async getVersionStamp(environmentUrl: string): Promise<string | null> {
    const cache = await this.load(environmentUrl);
    return cache?.manifest.serverVersionStamp ?? null;
  }

  /**
   * Update specific entities in the cache (delta update).
   * Merges new/changed entities into the existing cache.
   */
  async updateEntities(
    environmentUrl: string,
    updatedEntities: Record<string, EntityTypeInfo>,
    newVersionStamp: string | null,
  ): Promise<void> {
    const existing = await this.load(environmentUrl);
    const merged = existing?.entityTypeInfos ?? {};

    for (const [name, info] of Object.entries(updatedEntities)) {
      merged[name] = info;
    }

    await this.save(environmentUrl, merged, newVersionStamp);

    log.info(`Delta cache update: ${Object.keys(updatedEntities).length} entities updated`);
  }

  /**
   * Remove specific entities from the cache (for deleted entities).
   */
  async removeEntities(
    environmentUrl: string,
    deletedEntityNames: string[],
    newVersionStamp: string | null,
  ): Promise<void> {
    const existing = await this.load(environmentUrl);
    if (!existing) return;

    const merged = existing.entityTypeInfos;
    for (const name of deletedEntityNames) {
      delete merged[name];
    }

    await this.save(environmentUrl, merged, newVersionStamp);

    log.info(`Removed ${deletedEntityNames.length} entities from cache`);
  }

  /**
   * Delete the entire cache.
   */
  async clear(): Promise<void> {
    try {
      await fs.unlink(this.cacheFilePath);
      log.info('Metadata cache cleared');
    } catch (error: unknown) {
      if (!(error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT')) {
        throw error;
      }
    }
  }

  /**
   * Check if a cache file exists.
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.cacheFilePath);
      return true;
    } catch {
      return false;
    }
  }
}
