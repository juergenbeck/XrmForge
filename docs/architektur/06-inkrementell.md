# 6. Inkrementelle Generierung

## 6.1 Übersicht

Die inkrementelle Generierung verwendet die Dataverse-Funktion `RetrieveMetadataChanges`, um zu erkennen, welche Entitäten sich seit der letzten Generierung geändert haben. Dies reduziert die Generierungszeit von Sekunden auf Millisekunden (gemessen: 4720ms auf 473ms, 10-fache Verbesserung).

## 6.2 Komponenten

**ChangeDetector** (`src/metadata/change-detector.ts`):
- `getInitialVersionStamp()` - Erster Lauf: holt den initialen ServerVersionStamp
- `detectChanges(clientVersionStamp)` - Folgeläufe: gibt changedEntityNames, deletedEntityNames, newVersionStamp zurück

**MetadataCache** (`src/metadata/cache.ts`):
- Dateisystem-basiert: `.xrmforge/cache/metadata.json`
- Speichert: Manifest (Version, Umgebungs-URL, ServerVersionStamp, letzter Refresh, Entitätsliste) + entityTypeInfos pro Entität
- Validierung: prüft Cache-Version, Umgebungs-URL-Übereinstimmung, Dateiexistenz

## 6.3 Ablauf

```
Erster Lauf (kein Cache):
  1. Alle Entitäts-Metadaten abrufen
  2. getInitialVersionStamp()
  3. Cache mit ServerVersionStamp speichern

Folgelauf (Cache vorhanden):
  1. Cache laden, Umgebungs-URL validieren
  2. detectChanges(cachedVersionStamp)
  3. Nur geänderte Entitäten abrufen
  4. Gelöschte Entitäten aus Cache entfernen
  5. Cache mit neuem ServerVersionStamp speichern

Abgelaufener Stempel (>90 Tage):
  Fehlercode 0x80044352 erkannt
  Rückfall auf vollständigen Refresh
```

## 6.4 RetrieveMetadataChanges API

- **Typ:** OData-Funktion (GET, nicht POST)
- **URL:** `/RetrieveMetadataChanges(Query=@q,ClientVersionStamp=@s)?@q={...}&@s='...'`
- **Antwort:** EntityMetadata[] mit HasChanged-Flag, ServerVersionStamp, DeletedMetadata
