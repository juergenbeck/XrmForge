# 2. Package-Architektur

## 2.1 Package-Übersicht

| Package | Version | Tests | Beschreibung |
|---------|---------|-------|--------------|
| @xrmforge/typegen | 0.8.0 | 444 | Kern: Typgenerierungs-Engine, Metadaten-Client, HTTP-Client, Hilfsfunktionen |
| @xrmforge/cli | 0.4.2 | 10 | CLI: generate-, build-, init-Befehle |
| @xrmforge/testing | 0.2.0 | 76 | Test-Hilfsmittel: createFormMock, fireOnChange, setupXrmMock |
| @xrmforge/helpers | 0.1.0 | 59 | Browsersichere Laufzeit: select(), parseLookup(), typedForm(), Xrm-Konstanten, Action-Executors |
| @xrmforge/webapi | 0.1.0 | 45 | Typsicherer Xrm.WebApi-Client mit QueryBuilder |
| @xrmforge/devkit | 0.4.0 | 42 | Build-Orchestrierung, Scaffolding, AGENT.md-Generierung |
| @xrmforge/eslint-plugin | 0.2.0 | 32 | 5 D365-spezifische ESLint-Regeln |

**Gesamt:** 708 Tests über 7 Packages.

## 2.2 Abhängigkeitsgraph

```
@xrmforge/cli
  |-- @xrmforge/typegen (generate-Befehl)
  |-- @xrmforge/devkit  (build- + init-Befehle)
  '-- commander (CLI-Framework)

@xrmforge/typegen
  |-- @azure/identity  (Authentifizierung)
  '-- fast-xml-parser  (FormXml-Parsing)

@xrmforge/devkit
  '-- esbuild (IIFE-Bundling)

@xrmforge/testing     (keine Laufzeit-Abhängigkeiten)
@xrmforge/helpers     (keine Laufzeit-Abhängigkeiten)
@xrmforge/webapi      (keine Laufzeit-Abhängigkeiten)
@xrmforge/eslint-plugin (ESLint Peer-Abhängigkeit)
```

## 2.3 Package-Details

### @xrmforge/typegen

Das Kern-Package. Enthält:

- **TypeGenerationOrchestrator** - Koordiniert die gesamte Generierungs-Pipeline
- **MetadataClient** - Fragt Dataverse-Metadaten ab (Entitäten, Formulare, OptionSets, Custom APIs)
- **DataverseHttpClient** - Belastbarer REST-Client mit Retry, Rate Limiting, Nebenläufigkeitssteuerung
- **ChangeDetector** - Inkrementelle Generierung über RetrieveMetadataChanges
- **MetadataCache** - Dateisystem-basiertes Caching mit Versionsstempeln
- **Generators** - Entitäts-Interfaces, Formular-Interfaces, OptionSet-Enums, Fields-Enums, EntityNames, Navigations-Properties, Action/Function-Executors
- **Helpers** - select(), parseLookup(), parseFormattedValue() (verschoben nach @xrmforge/helpers)
- **Xrm-Konstanten** - DisplayState, FormNotificationLevel, RequiredLevel, SubmitMode, SaveMode, ClientType, ClientState (verschoben nach @xrmforge/helpers)
- **Authentifizierung** - createCredential()-Factory für 4 Authentifizierungsmethoden
- **Logging** - Scope-basierte Logger mit austauschbaren Senken (Console, JSON, Silent)
- **Fehler** - Strukturierte Fehlerhierarchie mit ErrorCode-Enum (AUTH_1xxx, API_2xxx, META_3xxx, GEN_4xxx, CONFIG_5xxx)

### @xrmforge/cli

Kommandozeilen-Interface basierend auf commander.js. Drei Befehle:
- `xrmforge generate` - Orchestriert den TypeGenerationOrchestrator
- `xrmforge build` - Delegiert an devkit build()
- `xrmforge init` - Delegiert an devkit scaffoldProject()

### @xrmforge/testing

FormContext-Mocking für Unit-Tests:
- `createFormMock<TForm>(values)` - Erstellt einen vollständigen Mock aus einfachen Schlüssel-Wert-Paaren
- `MockAttribute` - getValue/setValue, Dirty-Tracking, onChange-Handler, Required Level, Submit Mode
- `MockControl` - Sichtbar, Deaktiviert, Label, Benachrichtigungen
- `MockUi` - Formular-Benachrichtigungen, Tab/Section-Stubs
- `MockEntity` - Entitäts-ID, Name, Primärattribut
- `fireOnChange(fieldName)` - Löst registrierte onChange-Handler aus
- `setupXrmMock(options)` / `teardownXrmMock()` - Globaler Xrm-Mock mit WebApi/Navigation-Stubs

### @xrmforge/helpers

Bündelt allen browsersicheren Laufzeitcode. Keine Node.js-Abhängigkeiten. Enthält:
- **Web-API-Helpers** - select(), parseLookup(), parseFormattedValue()
- **Xrm-Konstanten** - DisplayState, SubmitMode, RequiredLevel, SaveMode, ClientType, ClientState, FormNotificationLevel, OperationType
- **Action/Function-Executors** - createBoundAction(), executeRequest(), withProgress()
- **typedForm()-Proxy** - Proxy-basierter FormContext-Wrapper, bei dem `form.name` an `getAttribute('name')` delegiert

### @xrmforge/webapi

Typsicherer Wrapper um Xrm.WebApi:
- `retrieve<T>(entityName, id, query)` - Einzelner Datensatz
- `retrieveMultiple<T>(entityName, query, options)` - Mit Paginierung (maxPages)
- `create(entityName, data)` - Gibt Datensatz-ID zurück
- `update(entityName, id, data)` - Void
- `remove(entityName, id)` - Void
- `QueryBuilder` - Fluent API: `.select().filter().orderBy().top().expand().build()`
- `WebApiError` - Strukturierte Fehler mit statusCode, errorCode, innerMessage

### @xrmforge/devkit

Build-Orchestrierung und Projekt-Scaffolding:
- `build(config)` - Parallele esbuild-IIFE-Builds über Promise.allSettled
- `watch(config)` - esbuild-Watch-Modus mit Rebuild-Callbacks
- `scaffoldProject(config)` - Generiert 11 Projektdateien aus Vorlagen
- `validateBuildConfig(config)` / `resolveBuildConfig(config)` - Konfigurationsvalidierung
- `BuildError` mit Codes: CONFIG_INVALID, ENTRY_NOT_FOUND, BUILD_FAILED, WATCH_ERROR
- Vorlagensystem: 7 Textvorlagen in `src/scaffold/templates/`, geladen über `template-loader.ts`

### @xrmforge/eslint-plugin

5 Regeln für D365-Formularskripte (ESLint v9 Flat Config):
- `no-xrm-page` (error) - Verbietet die veraltete Xrm.Page-API
- `no-magic-optionset` (warn) - Verbietet Magic Numbers in OptionSet-Vergleichen
- `no-sync-webapi` (error) - Verbietet synchrone XMLHttpRequest
- `require-error-handling` (warn) - Verlangt try/catch in asynchronen on*-Event-Handlern
- `require-namespace` (warn) - Verbietet window/globalThis-Zuweisungen
