# Incremental Generation

### 6.1 Overview

Incremental generation uses the Dataverse `RetrieveMetadataChanges` function to detect which entities have changed since the last generation. This reduces generation time from seconds to milliseconds (measured: 4720ms to 473ms, 10x improvement).

### 6.2 Components

**ChangeDetector** (`src/metadata/change-detector.ts`):
- `getInitialVersionStamp()` - First run: fetches the initial ServerVersionStamp
- `detectChanges(clientVersionStamp)` - Subsequent runs: returns changedEntityNames, deletedEntityNames, newVersionStamp

**MetadataCache** (`src/metadata/cache.ts`):
- Filesystem-based: `.xrmforge/cache/metadata.json`
- Stores: manifest (version, environment URL, ServerVersionStamp, last refreshed, entity list) + entityTypeInfos per entity
- Validation: checks cache version, environment URL match, file existence

### 6.3 Flow

```
First run (no cache):
  1. Fetch all entity metadata
  2. getInitialVersionStamp()
  3. Save cache with ServerVersionStamp

Subsequent run (cache exists):
  1. Load cache, validate environment URL
  2. detectChanges(cachedVersionStamp)
  3. Fetch only changed entities
  4. Remove deleted entities from cache
  5. Save cache with new ServerVersionStamp

Expired stamp (>90 days):
  Error code 0x80044352 detected
  Fall back to full refresh
```

### 6.4 RetrieveMetadataChanges API

- **Type:** OData Function (GET, not POST)
- **URL:** `/RetrieveMetadataChanges(Query=@q,ClientVersionStamp=@s)?@q={...}&@s='...'`
- **Response:** EntityMetadata[] with HasChanged flag, ServerVersionStamp, DeletedMetadata
