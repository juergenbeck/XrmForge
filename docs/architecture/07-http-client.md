# HTTP Client

### 7.1 DataverseHttpClient

The core HTTP client (`src/http/client.ts`) provides resilient communication with the Dataverse Web API.

**Key methods:**
- `get<T>(path, signal?)` - Single GET request with retry
- `getAll<T>(path, signal?)` - GET with automatic @odata.nextLink paging (max 100 pages)

### 7.2 Read-Only Default

The client defaults to `readOnly: true`, blocking POST/PATCH/PUT/DELETE requests. This prevents accidental data mutations during type generation. Write access requires explicit `readOnly: false`.

### 7.3 Retry with Exponential Backoff

- **Base delay:** 1000ms (configurable)
- **Max backoff:** 60 seconds
- **Jitter:** Random delay up to base delay
- **Formula:** `min(baseDelay * 2^(attempt-1) + jitter, 60000)`
- **Max retries:** configurable (default: 3)

### 7.4 Rate Limiting (HTTP 429)

- **Separate counter** from standard retries (not mixed)
- **Retry-After header** respected (seconds converted to milliseconds)
- **Max 10 consecutive 429 retries** (DEFAULT_MAX_RATE_LIMIT_RETRIES)
- 429 responses do NOT increment the standard retry counter

### 7.5 Concurrency Control

Non-recursive semaphore pattern:
- **maxConcurrency:** 5 (default)
- Wait queue with FIFO ordering
- All retries happen inside a single slot (prevents slot exhaustion)

### 7.6 Token Caching

- In-memory only (never persisted to disk)
- 5-minute buffer before expiry (TOKEN_BUFFER_MS = 300000)
- Pending token refresh promise prevents concurrent token requests

### 7.7 Input Sanitization

OData injection prevention:
- `sanitizeIdentifier()` - Regex `[a-zA-Z_][a-zA-Z0-9_]*`
- `sanitizeGuid()` - GUID format validation
- `escapeODataString()` - Single quote doubling

### 7.8 Error Handling

| HTTP Status | Behavior | Retried |
|-------------|----------|---------|
| 2xx | Success | No |
| 401 | Clear token cache, retry once | Yes (1x) |
| 429 | Respect Retry-After, separate counter | Yes (up to 10x) |
| 5xx | Exponential backoff | Yes (up to maxRetries) |
| 404, 403 | Non-retryable | No |
| Network error | Exponential backoff | Yes |
