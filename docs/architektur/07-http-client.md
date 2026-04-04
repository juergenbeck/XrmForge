# 7. HTTP-Client

## 7.1 DataverseHttpClient

Der zentrale HTTP-Client (`src/http/client.ts`) bietet belastbare Kommunikation mit der Dataverse Web API.

**Kernmethoden:**
- `get<T>(path, signal?)` - Einzelne GET-Anfrage mit Retry
- `getAll<T>(path, signal?)` - GET mit automatischer @odata.nextLink-Paginierung (max 100 Seiten)

## 7.2 Nur-Lesen-Standard

Der Client ist standardmäßig auf `readOnly: true` eingestellt und blockiert POST/PATCH/PUT/DELETE-Anfragen. Dies verhindert versehentliche Datenänderungen während der Typgenerierung. Schreibzugriff erfordert explizites `readOnly: false`.

## 7.3 Retry mit exponentiellem Backoff

- **Basisverzögerung:** 1000ms (konfigurierbar)
- **Maximaler Backoff:** 60 Sekunden
- **Jitter:** Zufällige Verzögerung bis zur Basisverzögerung
- **Formel:** `min(baseDelay * 2^(attempt-1) + jitter, 60000)`
- **Maximale Retries:** konfigurierbar (Standard: 3)

## 7.4 Rate Limiting (HTTP 429)

- **Separater Zähler** von Standard-Retries (nicht vermischt)
- **Retry-After-Header** wird respektiert (Sekunden in Millisekunden umgerechnet)
- **Maximal 10 aufeinanderfolgende 429-Retries** (DEFAULT_MAX_RATE_LIMIT_RETRIES)
- 429-Antworten inkrementieren den Standard-Retry-Zähler NICHT

## 7.5 Nebenläufigkeitssteuerung

Nicht-rekursives Semaphor-Muster:
- **maxConcurrency:** 5 (Standard)
- Warteschlange mit FIFO-Reihenfolge
- Alle Retries erfolgen innerhalb eines einzelnen Slots (verhindert Slot-Erschöpfung)

## 7.6 Token-Caching

- Nur im Speicher (wird niemals auf die Festplatte persistiert)
- 5-Minuten-Puffer vor Ablauf (TOKEN_BUFFER_MS = 300000)
- Ausstehende Token-Refresh-Promise verhindert gleichzeitige Token-Anfragen

## 7.7 Eingabe-Sanitisierung

OData-Injection-Prävention:
- `sanitizeIdentifier()` - Regex `[a-zA-Z_][a-zA-Z0-9_]*`
- `sanitizeGuid()` - GUID-Format-Validierung
- `escapeODataString()` - Verdopplung einfacher Anführungszeichen

## 7.8 Fehlerbehandlung

| HTTP-Status | Verhalten | Retry |
|-------------|-----------|-------|
| 2xx | Erfolg | Nein |
| 401 | Token-Cache leeren, einmal wiederholen | Ja (1x) |
| 429 | Retry-After respektieren, separater Zähler | Ja (bis zu 10x) |
| 5xx | Exponentieller Backoff | Ja (bis zu maxRetries) |
| 404, 403 | Nicht wiederholbar | Nein |
| Netzwerkfehler | Exponentieller Backoff | Ja |
