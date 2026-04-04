# 18. Designprinzipien

Die 18 Designprinzipien, die die gesamte XrmForge-Entwicklung bestimmen:

1. **Erweitern, nicht ersetzen** - Typen bauen auf @types/xrm auf, überschreiben sie nie.
2. **TypeScript durchgängig** - 100% TypeScript-nativ. Kein .NET, kein ADAL.
3. **Code muss bauen** - Jeder Arbeitsschritt endet mit grünem Build + Tests.
4. **Recherche vor Geschwindigkeit** - Untersuchen, vergleichen, entscheiden, dann implementieren. Niemals raten.
5. **Kein Modul ohne Grundlagen** - Fehlerbehandlung, Logging, Unit-Tests, JSDoc auf allen öffentlichen APIs.
6. **Monorepo-Disziplin** - Jedes Package eigenständig, keine zirkulären Abhängigkeiten, Barrel-Exports.
7. **Enterprise-Resilienz** - Retry + exponentielles Backoff, Rate-Limit-Erkennung, Token-Caching, Read-only als Standard.
8. **esbuild-first, webpack-kompatibel** - Standard: esbuild (schnell). webpack bleibt unterstützt. IIFE-Output für D365.
9. **Nur MSAL-Authentifizierung** - Ausschliesslich @azure/identity (kein Legacy-ADAL). Drei Flows: Client Credentials, Browser, Device Code.
10. **Review erforderlich** - Nach jedem Schritt sofortiges kritisches Review (6 Dimensionen). Nicht fragen, ob Review gewünscht ist.
11. **Session-State erforderlich** - session-state.md aktualisiert, Changelog geschrieben, offene Fragen erfasst.
12. **Keine halben Sachen** - Jeder Schritt vollständig abgeschlossen: grüner Build + Tests + Review vor dem nächsten Schritt.
13. **Fundierte Architekturentscheidungen** - Recherchieren, vergleichen, mit Pro/Contra empfehlen, Entscheidung einholen, persistieren.
14. **Abstraktion statt Vendor-Lock-in** - Externe Abhängigkeiten hinter Interfaces (Parser, Auth, Bundler).
15. **Zweisprachige Labels** - Primärsprache (1033/Englisch) für Bezeichner, Sekundärsprache in JSDoc. Deutsche Umlaute transliteriert.
16. **Review mit Recherche und Live-Verifikation** - Internetrecherche, Live-D365-Verifikation, Produktionscode-Prüfungen, Quellen zitieren.
17. **Aufschub hinterfragen** - "Später"-Check: Wird es schwieriger? API-Vertrag? Echter Aufwand? Technische Gründe?
18. **Read-only als Standard für Dataverse-Zugriff** - DataverseHttpClient ist standardmässig readOnly: true. Schreibzugriff ist ein explizites Opt-in.
