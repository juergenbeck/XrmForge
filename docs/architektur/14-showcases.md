# 14. Showcases

## 14.1 Markant WebResources (Produktions-Showcase)

Befindet sich im XrmForge-Workspace-Repository unter `docs/07_showcase/markant-webresources/`.

- **30 WebResources** in `src/forms/` (Account, Contact, Opportunity, Lead, Quote, Email, Task usw.)
- **1 gemeinsame Bibliothek** (DSGVO-Aufbewahrungsfristen-UI)
- **9 Testdateien** mit 59 Tests
- **79 generierte Typings:** 25 Form-Interfaces, 28 Entity-Interfaces, 22 OptionSet-Dateien, 4 Action-Executors
- **esbuild-Build** über xrmforge.config.json (32 Einträge)
- **Deploy-Skript** (deploy.mjs) mit @azure/identity-Authentifizierung, inkrementellem Deployment, Hash-basierter Änderungserkennung
- **27 Entitäten, 236 OptionSet-Enums, 95 Form-Interfaces, 7 Custom-API-Executors**

## 14.2 LMApp WebResources (KI-Vergleichs-Showcase)

Erstellt während der KI-Vergleichstests (Session 9). 18 Legacy-JavaScript-Formularskripte (~8.400 Zeilen) zu TypeScript mit XrmForge-Patterns konvertiert.

- **19 WebResources** mit Fields Enums, EntityNames, OptionSet Enums
- **84 Tests** in 8 Testdateien
- **XrmForge-optimiert:** Alle 10 AGENT.md-Regeln angewendet (FormContext-Cast, Fields Enum, EntityNames, OptionSet Enums, gemeinsames getLookupObject, Tab Enums)
