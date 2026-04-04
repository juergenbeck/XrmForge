# 11. AGENT.md System

## 11.1 Zweck

Die AGENT.md ist eine generierte Datei, die KI-Coding-Assistenten (Claude, ChatGPT, Copilot, Cursor) beibringt, wie sie optimale D365-Formularskripte mit XrmForge schreiben. Sie wird von `xrmforge init` erzeugt und im Projektstamm abgelegt.

## 11.2 Inhaltsstruktur

1. **Package-Übersicht** - Was jedes @xrmforge-Package tut
2. **10 Regeln: Immer** - Fields Enum, OptionSet Enum, FormContext-Cast, EntityNames, parseLookup, select, createFormMock, Modul-Exports, Tabs/Sections Enums, Fehlerbehandlung
3. **Regeln: Niemals** - Rohe Strings, Magic Numbers, Xrm.Page, synchrone XHR, eval, window-Zuweisungen
4. **Vorher/Nachher-Beispiele** - Feldzugriff, OptionSet-Vergleich, Testen
5. **Pattern-Erkennungstabelle** - Zuordnung von Legacy-Pattern zu XrmForge-Ersetzung
6. **OptionSet-Enum-Erstellungsanleitung** - Wie man Enums aus Magic Numbers in Legacy-Code erstellt
7. **Testen mit setupXrmMock** - Globales Xrm-Mock-Pattern
8. **Build-Befehle** - xrmforge build, Watch-Modus
9. **@types/xrm-Fallstricke** - Bekannte Probleme und Workarounds
10. **Dateistruktur** - Erwartetes Projektlayout

## 11.3 Template-System

Die AGENT.md ist als `src/scaffold/templates/AGENT.md` im devkit-Package gespeichert und wird zur Scaffolding-Zeit über `template-loader.ts` geladen. Es ist keine Variablenersetzung nötig (die Datei ist statisch).

## 11.4 Ergebnisse des KI-Vergleichstests

Fünf KI-Modelle wurden beim Konvertieren von Legacy-D365-JavaScript (account.js + lm_helper.js, 1.288 Zeilen) zu TypeScript mit XrmForge getestet:

| Rang | Modell | Punkte | Werkzeug | Stärke |
|------|--------|--------|----------|--------|
| 1 | Claude Opus 4.6 | 42/50 | Claude Code | Meiste Tests (62), beste Codestruktur |
| 2 | Claude Sonnet 4.6 | 41/50 | Claude Code | Meiste Bugs gefunden (5), bester DI-Ansatz |
| 3 | Cursor Composer 2 | 35/50 | Cursor IDE | Hat select() Node-API-Problem erkannt |
| 4 | ChatGPT GPT-4o | 30/50 | ChatGPT Web | Funktional, aber weniger XrmForge-spezifisch |
| 5 | MS Copilot | 12/50 | Browser-Chat | Kein Workspace-Zugriff, hat AGENT.md nie gesehen |

**Kriterien (11, maximal 5 Punkte je = 55 max):** Fields-Enum-Nutzung, OptionSet-Enums, FormContext-Typisierung, XrmForge-Helpers, Modul-Exports, Tests vorhanden, Testqualität, Fehlerbehandlung, Codequalität, gefundene Bugs, Dokumentation.

**Zentrale Erkenntnis:** Keine KI hat konsistent `@xrmforge/typegen/helpers`-Imports (select, parseLookup) verwendet. Dies bleibt die grösste Adoptionslücke.
