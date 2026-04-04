# 4. CLI-Befehle

## 4.1 `xrmforge generate`

Generiert TypeScript-Deklarationen aus einer Dataverse-Umgebung.

| Flag | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `--url <url>` | string | erforderlich | Dataverse-Umgebungs-URL |
| `--auth <method>` | string | erforderlich | Authentifizierungsmethode: client-credentials, interactive, device-code, token |
| `--tenant-id <id>` | string | variiert | Azure AD Tenant-ID |
| `--client-id <id>` | string | variiert | Azure AD Application-ID |
| `--client-secret <s>` | string | variiert | Client Secret (nur client-credentials) |
| `--token <token>` | string | variiert | Vorab erworbenes Bearer-Token (nur Token-Auth) |
| `--entities <list>` | string | - | Kommagetrennte logische Entitätsnamen |
| `--solutions <list>` | string | - | Kommagetrennte eindeutige Lösungsnamen |
| `--output <dir>` | string | ./typings | Ausgabeverzeichnis |
| `--label-language <n>` | string | 1033 | Primäre Label-Sprache (LCID) |
| `--secondary-language <n>` | string | - | Sekundäre Label-Sprache für JSDoc |
| `--no-forms` | flag | - | Formular-Interface-Generierung überspringen |
| `--no-optionsets` | flag | - | OptionSet-Enum-Generierung überspringen |
| `--actions` | flag | false | Custom-API-Executors generieren |
| `--actions-filter <prefix>` | string | - | Custom APIs nach Uniquename-Präfix filtern |
| `--cache` | flag | false | Metadaten-Caching für inkrementelle Generierung aktivieren |
| `--no-cache` | flag | - | Vollständige Metadaten-Aktualisierung erzwingen |
| `--cache-dir <dir>` | string | .xrmforge/cache | Cache-Verzeichnis |
| `-v, --verbose` | flag | false | Debug-Logging |

Mindestens eines von `--entities` oder `--solutions` ist erforderlich.

## 4.2 `xrmforge build`

Baut WebResources als IIFE-Bundles mit esbuild (über @xrmforge/devkit).

| Flag | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `--watch` | flag | false | Watch-Modus mit inkrementellen Rebuilds |
| `--minify` | flag | aus Konfiguration | Minifizierungseinstellung überschreiben |
| `--no-sourcemap` | flag | - | Source Maps deaktivieren |
| `--out-dir <dir>` | string | aus Konfiguration | Ausgabeverzeichnis überschreiben |
| `-v, --verbose` | flag | false | Fehlerstacks anzeigen |

Liest die Konfiguration aus `xrmforge.config.json`.

## 4.3 `xrmforge init`

Erstellt ein neues D365-Formularskript-Projekt.

| Flag | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `[dir]` | positional | . | Zielverzeichnis |
| `--name <name>` | string | Verzeichnisname | Projektname für package.json |
| `--prefix <prefix>` | string | contoso | Publisher-Präfix |
| `--namespace <ns>` | string | PascalCase(prefix) | Basis-Namespace für Skripte |
| `--skip-install` | flag | false | npm install überspringen |
| `--force` | flag | false | Nicht-leere Verzeichnisse erlauben |

Generiert 11 Dateien: package.json, tsconfig.json, xrmforge.config.json, vitest.config.ts, .gitignore, AGENT.md, example-form.ts, example-form.test.ts, typings/.gitkeep, GitHub Actions CI, Azure DevOps Pipeline.
