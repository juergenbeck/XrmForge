/**
 * @xrmforge/typegen - Metadata Change Detector
 *
 * Uses the Dataverse RetrieveMetadataChanges action to determine
 * which entities have changed since the last generation run.
 * This enables incremental type generation (only re-fetch changed entities).
 *
 * @see https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/samples/retrievemetadatachanges
 */

import type { DataverseHttpClient } from '../http/client.js';
import { MetadataError, ErrorCode } from '../errors.js';
import { createLogger } from '../logger.js';

const log = createLogger('change-detector');

/** Result of a change detection query */
export interface ChangeDetectionResult {
  /** Entity logical names that have changed (new or modified) */
  changedEntityNames: string[];
  /** Entity logical names that have been deleted */
  deletedEntityNames: string[];
  /** New server version stamp (store this for the next run) */
  newVersionStamp: string;
}

/** Dataverse error code for expired version stamps (90-day limit) */
const EXPIRED_VERSION_STAMP_ERROR = '0x80044352';

/**
 * Detects metadata changes in Dataverse using RetrieveMetadataChanges.
 *
 * Usage:
 * ```typescript
 * const detector = new ChangeDetector(httpClient);
 * const result = await detector.detectChanges(cachedVersionStamp);
 * // result.changedEntityNames = ['account', 'contact']
 * // result.newVersionStamp = 'new-stamp-to-cache'
 * ```
 */
export class ChangeDetector {
  constructor(private readonly http: DataverseHttpClient) {}

  /**
   * Detect which entities have changed since the given version stamp.
   *
   * @param clientVersionStamp - The ServerVersionStamp from the last run (from cache)
   * @returns Changed entity names, deleted entity names, and new version stamp
   * @throws {MetadataError} with META_VERSION_STAMP_EXPIRED if stamp is too old (>90 days)
   */
  async detectChanges(clientVersionStamp: string): Promise<ChangeDetectionResult> {
    log.info('Detecting metadata changes since last run');

    const requestBody = {
      Query: {
        Criteria: {
          FilterOperator: 'And',
          Conditions: [],
        },
        Properties: {
          AllProperties: false,
          PropertyNames: ['LogicalName'],
        },
      },
      ClientVersionStamp: clientVersionStamp,
      DeletedMetadataFilters: 'Entity',
    };

    interface RetrieveMetadataChangesResponse {
      EntityMetadata: Array<{
        LogicalName: string;
        HasChanged: boolean | null;
        MetadataId: string;
      }>;
      ServerVersionStamp: string;
      DeletedMetadata?: {
        Keys?: string[];
        [key: string]: unknown;
      };
    }

    let response: RetrieveMetadataChangesResponse;
    try {
      response = await this.http.postReadOnly<RetrieveMetadataChangesResponse>(
        '/RetrieveMetadataChanges',
        requestBody,
      );
    } catch (error: unknown) {
      // Check for expired version stamp
      if (this.isExpiredVersionStampError(error)) {
        throw new MetadataError(
          ErrorCode.META_VERSION_STAMP_EXPIRED,
          'Cached version stamp has expired (>90 days). A full metadata refresh is required.',
          { clientVersionStamp },
        );
      }
      throw error;
    }

    // Extract changed entity names (HasChanged = true or null means changed)
    const changedEntityNames = (response.EntityMetadata ?? [])
      .filter((e) => e.HasChanged !== false)
      .map((e) => e.LogicalName)
      .filter(Boolean);

    // Extract deleted entity names from DeletedMetadata
    const deletedEntityNames: string[] = [];
    if (response.DeletedMetadata?.Keys) {
      // DeletedMetadata.Keys contains MetadataIds, not LogicalNames
      // We log them but cannot resolve to names without the cache
      log.info(`${response.DeletedMetadata.Keys.length} entity metadata IDs were deleted`);
    }

    const newVersionStamp = response.ServerVersionStamp;

    log.info(`Change detection complete: ${changedEntityNames.length} changed, ${deletedEntityNames.length} deleted`, {
      changedEntityNames: changedEntityNames.length <= 10 ? changedEntityNames : `${changedEntityNames.length} entities`,
      newVersionStamp: newVersionStamp.substring(0, 20) + '...',
    });

    return {
      changedEntityNames,
      deletedEntityNames,
      newVersionStamp,
    };
  }

  /**
   * Perform an initial metadata query to get the first ServerVersionStamp.
   * This is used on the very first run (no cache exists).
   *
   * @returns The initial server version stamp
   */
  async getInitialVersionStamp(): Promise<string> {
    log.info('Fetching initial server version stamp');

    const requestBody = {
      Query: {
        Criteria: {
          FilterOperator: 'And',
          Conditions: [],
        },
        Properties: {
          AllProperties: false,
          PropertyNames: ['LogicalName'],
        },
      },
    };

    interface InitialResponse {
      ServerVersionStamp: string;
    }

    const response = await this.http.postReadOnly<InitialResponse>(
      '/RetrieveMetadataChanges',
      requestBody,
    );

    log.info('Initial version stamp acquired');
    return response.ServerVersionStamp;
  }

  /** Check if an error is the expired version stamp error (0x80044352) */
  private isExpiredVersionStampError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    // Check message and context.responseBody (HttpClient puts body text in context)
    const contextBody = (error as Record<string, unknown>)?.context
      ? String((error as Record<string, Record<string, unknown>>).context.responseBody ?? '')
      : '';
    const combined = msg + contextBody;
    return combined.includes(EXPIRED_VERSION_STAMP_ERROR) || combined.includes('ExpiredVersionStamp');
  }
}
