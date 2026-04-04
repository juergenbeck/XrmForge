# 1. Zusammenfassung

XrmForge ist ein quelloffenes TypeScript-Toolkit für typsichere Dynamics 365 / Dataverse WebResource-Entwicklung. Es generiert TypeScript-Deklarationen aus Live-Dataverse-Metadaten und verwandelt Laufzeit-String-Fehler in Kompilierzeit-Typfehler.

**Kernnutzenversprechen:** Jeder Feldname, OptionSet-Wert, Tab-Name, Entitätsname und Subgrid-Name wird zu einer typisierten Konstante mit IDE-Autovervollständigung und Kompilierzeit-Validierung.

**Zielgruppe:** D365-Entwickler, die Formularskripte (WebResources) in JavaScript/TypeScript schreiben und Kompilierzeit-Sicherheit, null Magic Strings und moderne Werkzeuge (esbuild, vitest, ESLint) wollen.

**Technologie-Stack:** TypeScript, pnpm-Monorepo mit Turborepo, esbuild für IIFE-Bundles, vitest für Tests, @azure/identity für Authentifizierung, fast-xml-parser für FormXml-Parsing.

**npm-Organisation:** [@xrmforge](https://www.npmjs.com/org/xrmforge)
