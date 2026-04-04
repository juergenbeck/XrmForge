# 17. Roadmap

## 17.1 Nächste Schritte (Prioritätsreihenfolge)

1. **parseLookup/select-Adoption** - AGENT.md-Beispiele verbessern, damit KI-Assistenten konsistent `/helpers`-Imports verwenden
2. **LMApp-Showcase-Neugenerierung** - Mit aktuellen Releases (testing@0.2.0, devkit@0.4.0 mit verbesserter AGENT.md)
3. **KI-Battle Runde 3** - Sonnet vs. Opus erneut testen nach Verbesserungen, um Fortschritt zu messen
4. **Dokumentationswebsite** - xrmforge.dev oder xrmforge.io (OE-3)

## 17.2 Offene Entscheidungen

| ID | Entscheidung | Status |
|----|--------------|--------|
| OE-1 | npm-Scope-Verfügbarkeit (@xrmforge) | Offen |
| OE-2 | GitHub-Org vs. persönliches Repo | Entschieden: persönlich (juergenbeck/XrmForge) |
| OE-3 | Dokumentationsdomain (xrmforge.dev oder .io) | Offen |
| OE-4 | Dataverse-Testumgebung für Integrationstests | Offen |
| OE-5 | Publisher-Prefix und Solution-Name für PCF/WebResource-Tests | Offen |

## 17.3 Zukünftige Möglichkeiten

- Relationship-Names const enum (OE-7, niedrige Priorität)
- @xrmforge/webapi mit Action/Function-Unterstützung (DataverseHttpClient wiederverwenden)
- Plugin-System für benutzerdefinierte Generatoren und Typ-Zuordnungen
- Serverseitige Generierung (Custom API in Dataverse)
