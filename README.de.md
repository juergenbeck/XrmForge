# XrmForge

[Read in English](README.md)

**Typsicheres TypeScript für Dynamics 365 CE / Model-Driven Apps.**

XrmForge liest die Dataverse-Metadaten deiner Umgebung und generiert TypeScript-Deklarationen, die Laufzeitfehler in Kompilierfehler verwandeln -- damit Fehler auffallen, bevor sie in die Produktion gelangen.

---

## Inhaltsverzeichnis

- [1. Was ist XrmForge?](#1-was-ist-xrmforge)
- [2. Features](#2-features)
- [3. Voraussetzungen](#3-voraussetzungen)
- [4. Schnellstart (5 Minuten)](#4-schnellstart-5-minuten)
- [5. Projektstruktur](#5-projektstruktur)
- [6. Typen generieren](#6-typen-generieren)
  - [CLI-Referenz](#cli-referenz)
  - [Authentifizierung](#authentifizierung)
  - [Azure App-Registrierung](#azure-app-registrierung)
  - [Konfigurationsdatei](#konfigurationsdatei)
- [7. Generierte Typen verwenden](#7-generierte-typen-verwenden)
  - [tsconfig.json](#tsconfigjson)
  - [Ein Formularskript schreiben](#ein-formularskript-schreiben)
  - [Web-API-Abfragen mit Fields-Enum](#web-api-abfragen-mit-fields-enum)
  - [Custom-Action-Executors](#custom-action-executors)
- [8. Für D365 bauen](#8-für-d365-bauen)
  - [Warum IIFE?](#warum-iife)
  - [build.mjs](#buildmjs)
  - [package.json-Skripte](#packagejson-skripte)
  - [Gemeinsame Bibliotheken](#gemeinsame-bibliotheken)
- [9. In D365 deployen](#9-in-d365-deployen)
- [10. Debugging](#10-debugging)
- [11. Häufige Muster](#11-häufige-muster)
- [12. Pakete](#12-pakete)
- [13. Für Framework-Entwickler](#13-für-framework-entwickler)
- [14. Fehlerbehebung](#14-fehlerbehebung)
- [15. Roadmap](#15-roadmap)
- [16. Lizenz](#16-lizenz)

---

## 1. Was ist XrmForge?

XrmForge generiert typsichere TypeScript-Deklarationen aus deiner Dynamics-365-Umgebung. Es erweitert `@types/xrm` (ersetzt es niemals), sodass die generierten Typen zusammen mit PCF-Controls, Drittanbieterbibliotheken und dem gesamten Microsoft-Ökosystem funktionieren.

**Vor XrmForge** (reines JavaScript, kein Sicherheitsnetz):

```typescript
const formContext = executionContext.getFormContext();
const name = formContext.getAttribute("naem");       // Tippfehler, gibt null zurück
name.setValue("Contoso");                             // Kein Kompilierfehler, Absturz zur Laufzeit!

// 12 Zeilen Boilerplate für einen einzigen Custom-Action-Aufruf
const request = {
  getMetadata: () => ({
    boundParameter: 'entity',
    parameterTypes: { entity: { typeName: 'mscrm.quote', structuralProperty: 5 } },
    operationName: 'contoso_winquote', operationType: 0,
  }),
  entity: { id: recordId, entityType: 'quote' },
};
await (Xrm.WebApi as any).online.execute(request);
```

**Nach XrmForge** (drei Ebenen der Typsicherheit):

```typescript
// Ebene 1: Typisiertes getAttribute mit Fields-Enum
const formContext = executionContext.getFormContext() as AccountForm;
const name = formContext.getAttribute(Fields.AccountName);  // StringAttribute, nicht generisch
name.setValue(123);                                          // Kompilierfehler!
formContext.getAttribute("naem");                             // Kompilierfehler!

// Ebene 2: TypedForm mit direktem Memberzugriff (kein Boilerplate)
const form = typedForm<AccountFormTypeInfo>(formContext);
form.name.setValue("Contoso Ltd");                // Direkter Property-Zugriff
form.revenue.setValue(1000000);                   // NumberAttribute, typisiert
form.industrycode.setValue(IndustryCode.Finance); // OptionSet-Enum, keine magische Zahl

// Ebene 3: Generierte Custom-Action-Executors (1 Zeile statt 12)
import { WinQuote } from '../generated/actions/quote';
const response = await WinQuote.execute(recordId);  // Vollständig typisiert, keine rohen Strings

// Mit typisierten Parametern und Antwort
import { ValidateMandatoryFields } from '../generated/actions/global';
const result = await ValidateMandatoryFields.execute({
  TargetId: opportunityId,     // string (als Guid typisiert)
  RuleSet: 'Unified_Fullversion',
  Language: 'de',
});
if (!result.IsValid) {         // boolean (typisiert)
  alert(result.MessageDe);     // string (typisiert)
}
```

Jedes Feld, jedes Formular, jede Custom API wird zu einem Vertrag zur Kompilierzeit. Tippfehler, falsche Typen, fehlende Felder und falsche Aktionsparameter werden vom TypeScript-Compiler gefunden -- nicht von einem Tester, der Formulare durchklickt.

---

## 2. Features

- **Entity-Interfaces** -- Typisierte Web-API-Antwortobjekte mit allen Attributen korrekt typisiert (string, number, boolean, Lookup, OptionSet, DateTime).
- **Formular-Interfaces** -- Pro Formular Überladungen für `getAttribute()` und `getControl()`. Nur Felder, die tatsächlich auf dem Formular vorhanden sind, sind gültig. Kein String-Fallback, kein `any`.
- **OptionSet-Enums** -- Jedes Auswahllisten-, Status- und Zustandsfeld wird zu einem `const enum`. Kein Laufzeit-Overhead (Werte werden von TypeScript eingebettet).
- **Fields-Enums** -- `const enum` mit allen Entity-Feldern für typsichere `$select`-Abfragen über die Web API.
- **Navigationseigenschaften** -- `const enum` für Lookup-Feld-Navigationseigenschaftsnamen, verwendet mit `parseLookup()` und `$expand`.
- **Action/Function-Executors** -- Aus Custom-API-Metadaten generiert. Typsichere Parameter und Antworten, mit `execute()` und `request()` (für `executeMultiple`-Batching).
- **Web-API-Hilfsfunktionen** -- `select()`, `parseLookup()`, `parseFormattedValue()`, `withProgress()`, `callCloudFlow()` und mehr.
- **Xrm-Konstanten** -- `DisplayState`, `FormNotificationLevel`, `RequiredLevel`, `SubmitMode`, `SaveMode`, `ClientType`, `OperationType` und andere als `const enum`. Keine rohen Strings mehr.
- **Zweisprachige Labels** -- JSDoc-Kommentare zeigen beide Sprachen: `/** Account Name | Firmenname */`. Autovervollständigung in VS Code zeigt beide.
- **Formular-Tests** -- `@xrmforge/testing`-Paket: Typsicherer Mock-Builder für D365-Formulare. `createFormMock<AccountForm>({ name: 'Contoso' })` erzeugt ein zur Kompilierzeit validiertes Mock-Objekt mit `getAttribute()`, `getControl()`, `ui.setFormNotification()` und Event-Context-Unterstützung. Kein `as any` mehr.
- **Inkrementelle Generierung** -- `--cache` Flag aktiviert Metadata-Caching. Nur Entities mit geänderten Metadaten werden neu geladen, per `RetrieveMetadataChanges` Delta-Erkennung. Erster Lauf: Full Refresh. Folge-Läufe: 10x schneller.
- **Build-Orchestrierung** -- `xrmforge build` erzeugt IIFE-Bundles aus deklarativer Config. Keine esbuild-Config-Dateien nötig. `xrmforge build --watch` für inkrementelle Rebuilds (~10ms). Basiert auf `@xrmforge/devkit`.

---

## 3. Voraussetzungen

Wenn du noch nie mit Node.js oder TypeScript gearbeitet hast, folge jedem Schritt unten. Falls du bereits eine funktionierende Umgebung hast, springe direkt zum [Schnellstart](#4-schnellstart-5-minuten).

### Git

Herunterladen und installieren von [https://git-scm.com](https://git-scm.com). Nach der Installation überprüfen:

```bash
git --version
# git version 2.44.0 (oder höher)
```

### Node.js (Version 20 oder höher)

LTS-Version herunterladen von [https://nodejs.org](https://nodejs.org). Das Installationsprogramm enthält `npm` (den Paketmanager). Nach der Installation beides überprüfen:

```bash
node --version
# v20.11.0 (oder höher)

npm --version
# 10.2.0 (oder höher)
```

### VS Code (empfohlen)

Herunterladen von [https://code.visualstudio.com](https://code.visualstudio.com). Für die beste Erfahrung folgende Erweiterungen installieren:

- **ESLint** (`dbaeumer.vscode-eslint`) -- findet Fehler beim Tippen
- **TypeScript Importer** -- automatische Imports für generierte Typen

### Eine Dynamics-365-CE-Umgebung

Du benötigst Administratorzugriff (oder zumindest Lesezugriff auf Entity-Metadaten) auf die Dataverse-Umgebung, für die Typen generiert werden sollen.

### Authentifizierung (eine der folgenden)

XrmForge unterstützt mehrere Authentifizierungsmethoden. Für Interactive und Device Code kann Microsofts bekannte Sample App ID (`51f81489-12ee-4a9e-aaae-a2591f45987d`) verwendet werden, eine eigene App-Registrierung ist zum Einstieg nicht nötig:

- **Interaktiver Browser** (empfohlen für den Einstieg): Öffnet einen Browser, du meldest dich an. Funktioniert mit der Microsoft Sample App ID, keine eigene App-Registrierung nötig.
- **Device Code**: Zeigt einen Code an, den du unter microsoft.com/devicelogin eingibst. Funktioniert auf headless-Terminals. Funktioniert ebenfalls mit der Sample App ID.
- **Client Credentials**: Service Principal mit Client Secret. Für CI/CD-Pipelines. Erfordert eine eigene App-Registrierung mit Admin-Zustimmung.
- **Token**: Einen vorab abgerufenen Bearer-Token übergeben. Keine App-Registrierung nötig.

Die Tenant ID lässt sich über [whatismytenantid.com](https://www.whatismytenantid.com) ermitteln, einfach den Domänennamen eingeben.

Weitere Details unter [Authentifizierung](#authentifizierung) und [Azure App-Registrierung](#azure-app-registrierung) weiter unten.

---

## 4. Schnellstart (5 Minuten)

Diese Anleitung führt dich von null zu generierten Typen. Jeder Befehl ist kopierbereit.

**Schritt 1: Einen Projektordner erstellen und initialisieren.**

```bash
mkdir my-d365-project
cd my-d365-project
npm init -y
```

**Schritt 2: XrmForge und Entwicklungsabhängigkeiten installieren.**

```bash
npm install --save-dev @xrmforge/cli @types/xrm typescript esbuild
```

**Schritt 3: Typen aus der Umgebung generieren.**

`YOUR_TENANT_ID` durch die Azure AD Tenant ID ersetzen (siehe [Authentifizierung](#authentifizierung) zum Ermitteln). Die Client ID unten ist Microsofts bekannte Sample App ID, eine eigene App-Registrierung ist nicht nötig.

```bash
npx xrmforge generate \
  --url https://myorg.crm4.dynamics.com \
  --auth interactive \
  --tenant-id YOUR_TENANT_ID \
  --client-id 51f81489-12ee-4a9e-aaae-a2591f45987d \
  --entities account,contact,opportunity \
  --output ./generated \
  --secondary-language 1031
```

Dadurch wird ein Browserfenster zur Authentifizierung geöffnet, die Entity-Metadaten werden gelesen und `.ts`-Dateien in `./generated/` geschrieben. `--secondary-language 1031` fügt deutsche Labels als JSDoc-Kommentare hinzu (optional).

**Schritt 4: TypeScript einrichten.**

`tsconfig.json` erstellen:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "types": ["xrm"],
    "strict": true,
    "noEmit": true
  },
  "include": [
    "src/**/*.ts",
    "generated/**/*.ts"
  ]
}
```

**Schritt 5: Das erste Formularskript schreiben.**

`src/forms/account-form.ts` erstellen:

```typescript
import type { AccountAccountForm as AccountForm } from '../../generated/forms/account.js';
import { AccountAccountFormFieldsEnum as Fields } from '../../generated/forms/account.js';

export function onLoad(executionContext: Xrm.Events.EventContext): void {
  const formContext = executionContext.getFormContext() as AccountForm;

  const name = formContext.getAttribute(Fields.AccountName);
  if (!name.getValue()) {
    formContext.ui.setFormNotification(
      "Account name is required.",
      "WARNING",
      "name-warning",
    );
  }
}
```

**Schritt 6: Typen prüfen.**

```bash
npx tsc --noEmit
```

Wenn dieser Befehl ohne Fehler durchläuft, funktionieren die Typen. Weiter zu [Für D365 bauen](#8-für-d365-bauen-esbuild), um uploadfähige `.js`-Dateien zu erzeugen.

---

## 5. Projektstruktur

Ein typisches D365-TypeScript-Projekt mit XrmForge:

```
my-d365-project/
  src/
    forms/              # Eine .ts-Datei pro Formular-Event-Handler
      account-form.ts
      contact-form.ts
    shared/             # Gemeinsame Hilfsbibliotheken (z.B. DSGVO-Helfer)
      notifications.ts
  generated/            # Von XrmForge generiert (nicht manuell bearbeiten)
    entities/           # Entity-Daten-Interfaces (für Web-API-Antworten)
    forms/              # Typisierter FormContext pro Entity/Formular
    optionsets/         # OptionSet-const-Enums
    fields/             # Entity-Fields-Enums für $select-Abfragen
    actions/            # Custom-API-Executors (.ts)
    index.ts            # Barrel-Datei mit export * from Re-Exports
  dist/                 # Build-Ausgabe (IIFE-.js-Dateien für D365-Upload)
  tsconfig.json         # TypeScript-Konfiguration
  build.mjs             # esbuild-Build-Skript
  xrmforge.config.json  # Optional: XrmForge-CLI-Konfiguration
  package.json
```

Das `generated/`-Verzeichnis ist durch erneutes Ausführen des Generators vollständig neu erstellbar. Du kannst es entweder in die Versionskontrolle aufnehmen (damit CI keinen Dataverse-Zugriff braucht) oder es zu `.gitignore` hinzufügen und bei Bedarf generieren.

---

## 6. Typen generieren

### CLI-Referenz

```bash
npx xrmforge generate [options]
```

| Flag | Beschreibung | Standard |
|------|-------------|---------|
| `--url <url>` | Dataverse-Umgebungs-URL (z.B. `https://myorg.crm4.dynamics.com`). Fällt auf `XRMFORGE_URL` zurück | Pflichtfeld |
| `--auth <method>` | Authentifizierungsmethode: `interactive`, `client-credentials`, `device-code`, `token` | Pflichtfeld |
| `--tenant-id <id>` | Azure-AD-Mandanten-ID. Fällt auf `XRMFORGE_TENANT_ID` zurück | Pflichtfeld für die meisten Methoden |
| `--client-id <id>` | Azure-AD-Anwendungs-(Client-)ID. Fällt auf `XRMFORGE_CLIENT_ID` zurück | Pflichtfeld für die meisten Methoden |
| `--client-secret <secret>` | Client Secret (nur für `client-credentials`). Umgebungsvariable `XRMFORGE_CLIENT_SECRET` gegenüber diesem Flag bevorzugen | -- |
| `--token <token>` | Vorab abgerufener Bearer-Token (für `token`-Auth). Umgebungsvariable `XRMFORGE_TOKEN` bevorzugen | -- |
| `--entities <list>` | Kommagetrennte logische Entity-Namen (z.B. `account,contact,opportunity`) | -- |
| `--solutions <list>` | Komma-getrennte Lösungsnamen (findet alle Entities in diesen Lösungen) | -- |
| `--output <dir>` | Ausgabeverzeichnis für generierte Dateien | `./generated` |
| `--label-language <code>` | Primäre Label-Sprache (LCID) | `1033` (Englisch) |
| `--secondary-language <code>` | Sekundäre Label-Sprache (LCID) für zweisprachige JSDoc-Kommentare | -- |
| `--actions` | Custom-API-Executors generieren (Action/Function) | Aus |
| `--actions-filter <prefix>` | Nur Actions mit diesem Prefix generieren (z.B. `contoso_`) | Alle Actions |
| `--cache` | Metadata-Caching aktivieren (inkrementelle Generierung per Delta-Erkennung) | Aus |
| `--no-cache` | Metadata-Cache explizit deaktivieren (Full Refresh erzwingen) | -- |
| `--cache-dir <dir>` | Verzeichnis für den Metadata-Cache | `.xrmforge-cache` |
| `--check` | Drift-Check: Vergleich gegen das Ausgabeverzeichnis ohne zu schreiben. Exit 0 = aktuell, 1 = Fehler, 2 = Drift | Aus |
| `--no-forms` | Formular-Interface-Generierung überspringen | Formulare aktiv |
| `--no-optionsets` | OptionSet-Enum-Generierung überspringen | OptionSets aktiv |
| `-v, --verbose` | Ausführliches/Debug-Logging aktivieren | Aus |

Entweder `--entities` oder `--solutions` muss angegeben werden (oder beides). Bei `--solutions` findet XrmForge alle Entities in diesen Lösungen. Mehrere Lösungen werden zusammengeführt, Duplikate entfernt.

### Drift-Erkennung (`--check`)

Generierte Dateien sind ein Snapshot der Dataverse-Umgebung. Ändert sich die Umgebung danach (Custom-API-Parameter mit anderem Typ neu angelegt, Feld ergänzt, OptionSet-Wert geändert), driften die eingecheckten Dateien still: TypeScript kompiliert weiter, Tests gegen Mocks bleiben grün, und der Fehler erscheint erst zur Laufzeit als kryptischer OData-Fehler.

`xrmforge generate --check` macht diesen Drift sichtbar: Die komplette Generierung läuft in den Speicher und wird Byte für Byte gegen das Ausgabeverzeichnis verglichen, **ohne irgendetwas zu schreiben** (weder Output noch Cache). Der Report ist nach Kategorien gruppiert (Entities, Fields, Forms, OptionSets, Actions) mit einer von drei Drift-Klassen pro Datei: `changed`, `missing` oder `orphaned` (Objekt wurde in Dataverse gelöscht). Auch Hand-Edits an generierten Dateien werden als `changed` erkannt.

Exit-Codes folgen der Konvention von `terraform plan -detailed-exitcode` / `prisma migrate diff --exit-code`:

| Exit-Code | Bedeutung |
|---|---|
| `0` | Generierte Dateien sind aktuell |
| `1` | Fehler (Authentifizierung, Netzwerk, Konfiguration) |
| `2` | Drift erkannt |

Typischer CI-Schritt (nightly oder pro Pipeline-Lauf). Verbindung und Credentials kommen aus
`XRMFORGE_*`-Umgebungsvariablen (siehe [Authentifizierung](#authentifizierung)), sodass kein
Secret auf der Kommandozeile erscheint:

```bash
# env: XRMFORGE_URL, XRMFORGE_TENANT_ID, XRMFORGE_CLIENT_ID, XRMFORGE_CLIENT_SECRET
npx xrmforge generate \
  --auth client-credentials \
  --solutions MeineSolution --actions \
  --output ./generated --check
```

Hinweise zum Byte-Vergleich:

1. **Nach einem typegen/cli-Upgrade** kann der neuere Generator anderen Output erzeugen, ohne dass sich die Umgebung geändert hat. Erwartete Reaktion: regenerieren und committen.
2. **`generated/` nicht nachbearbeiten**, weder mit Formattern (Prettier) noch mit Lint-Autofixes — das ändert Inhalt und wird als echter Drift gemeldet. Zeilenenden sind *kein* Drift: `--check` vergleicht zeilenenden-normalisiert, eine CRLF-Working-Copy (git `core.autocrlf`, Windows-Default) färbt den Check also nicht rot. Gescaffoldete Projekte (`xrmforge init`) bringen zudem eine `.gitattributes` mit, die `generated/**` auf `eol=lf` pinnt (saubere Diffs).

### Authentifizierung

Drei Methoden werden unterstützt, alle basierend auf `@azure/identity` (MSAL). Eine vierte Methode (`token`) erlaubt die Übergabe eines vorab abgerufenen Bearer-Tokens.

**Tenant ID finden:** `https://login.microsoftonline.com/DEINE_EMAIL_DOMAIN/.well-known/openid-configuration` im Browser öffnen (E-Mail-Domäne wie `contoso.com` verwenden, nicht die CRM-URL). Die Tenant ID steht im `issuer`-Feld.

**Client ID:** Für Interactive und Device Code die bekannte Microsoft Sample App ID verwenden: `51f81489-12ee-4a9e-aaae-a2591f45987d`. Keine eigene App-Registrierung nötig. Für Client Credentials (CI/CD) wird eine eigene App-Registrierung benötigt (siehe [Azure App-Registrierung](#azure-app-registrierung)).

**Interaktiv (Entwickler-Laptop, öffnet Browser)**

Am besten für die lokale Entwicklung. Öffnet ein Browserfenster zur Anmeldung.

```bash
npx xrmforge generate \
  --url https://myorg.crm4.dynamics.com \
  --auth interactive \
  --tenant-id YOUR_TENANT_ID \
  --client-id 51f81489-12ee-4a9e-aaae-a2591f45987d \
  --entities account,contact \
  --output ./generated
```

**Client Credentials (CI/CD, Service Principal)**

Am besten für automatisierte Pipelines. Verwendet ein Client Secret, keine Benutzerinteraktion. Erfordert eine eigene App-Registrierung (siehe [Azure App-Registrierung](#azure-app-registrierung)).

```bash
npx xrmforge generate \
  --url https://myorg.crm4.dynamics.com \
  --auth client-credentials \
  --tenant-id YOUR_TENANT_ID \
  --client-id YOUR_OWN_APP_ID \
  --client-secret YOUR_SECRET \
  --entities account,contact \
  --output ./generated
```

In CI/CD das Secret (und die übrige Verbindung) über `XRMFORGE_*`-Umgebungsvariablen statt als
Kommandozeilen-Flags übergeben, damit das Secret weder im Shell-Verlauf noch in der Prozessliste
auftaucht:

```bash
# env: XRMFORGE_URL, XRMFORGE_TENANT_ID, XRMFORGE_CLIENT_ID, XRMFORGE_CLIENT_SECRET
npx xrmforge generate --auth client-credentials --entities account,contact --output ./generated
```

**Device Code (headless-Terminal, SSH-Sitzungen)**

Am besten für Remote-Server ohne Browser. Zeigt einen Code an, den du unter https://microsoft.com/devicelogin eingibst.

```bash
npx xrmforge generate \
  --url https://myorg.crm4.dynamics.com \
  --auth device-code \
  --tenant-id YOUR_TENANT_ID \
  --client-id 51f81489-12ee-4a9e-aaae-a2591f45987d \
  --entities account,contact \
  --output ./generated
```

**Token (vorab abgerufener Bearer-Token)**

Für Umgebungen, in denen Tokens extern beschafft werden. Die Umgebungsvariable `XRMFORGE_TOKEN` gegenüber dem Flag `--token` bevorzugen, um die Anzeige des Tokens im Shell-Verlauf zu vermeiden.

```bash
export XRMFORGE_TOKEN="eyJ0eXAiOi..."

npx xrmforge generate \
  --url https://myorg.crm4.dynamics.com \
  --auth token \
  --entities account,contact \
  --output ./generated
```

| Methode | Anwendungsfall | Erforderliche Flags |
|--------|----------|----------------|
| `interactive` | Lokale Entwicklung (öffnet Browser) | `--tenant-id`, `--client-id` |
| `client-credentials` | CI/CD-Pipelines (Service Principal) | `--tenant-id`, `--client-id`, `--client-secret` |
| `device-code` | Headless-Terminals | `--tenant-id`, `--client-id` |
| `token` | Externer Token-Anbieter | Umgebungsvariable `XRMFORGE_TOKEN` oder `--token` |

#### Umgebungsvariablen

Verbindung und Credentials werden auch aus Umgebungsvariablen aufgelöst, damit CI-Pipelines
(und lokale Shells) keine Secrets auf der Kommandozeile übergeben müssen:

| Variable | Ersetzt Flag |
|----------|--------------|
| `XRMFORGE_URL` | `--url` |
| `XRMFORGE_TENANT_ID` | `--tenant-id` |
| `XRMFORGE_CLIENT_ID` | `--client-id` |
| `XRMFORGE_CLIENT_SECRET` | `--client-secret` |
| `XRMFORGE_TOKEN` | `--token` |

Dieselben Variablen dürfen in einer lokalen **`.env`** neben der `xrmforge.config.json` stehen;
`generate` lädt sie automatisch (eine echte Umgebungsvariable schlägt die `.env`). Und in einem
**interaktiven Terminal** fragt `generate` einen noch fehlenden Pflichtwert ab (Secret-Eingabe
verdeckt) und bietet an, die eingegebenen Werte in `./.env` zu speichern (auf POSIX `chmod 600`).
Ohne Terminal (CI) wird nichts abgefragt, stattdessen kommt der gewohnte Fehler. `xrmforge init`
nimmt `.env` in die `.gitignore` auf.

Auflösungs-Vorrang pro Wert: erst das explizite CLI-Flag, dann die Umgebungsvariable, dann
`./.env`, dann `xrmforge.config.json`, zuletzt der interaktive Prompt. Nicht-geheime
Verbindungsdefaults (URL, Tenant, Client, Label-Sprachen, Scope) gehören in `xrmforge.config.json`;
das Client Secret bleibt aus dem Repo heraus und kommt nur über `XRMFORGE_CLIENT_SECRET` oder eine
git-ignorierte `.env` (das Secret wird nie aus der Config-Datei gelesen).

### Azure App-Registrierung

Falls noch keine App-Registrierung vorhanden ist, diese Schritte im Azure-Portal befolgen:

1. [https://portal.azure.com](https://portal.azure.com) aufrufen und anmelden.
2. Zu **Azure Active Directory** (oder **Microsoft Entra ID**) navigieren, dann **App-Registrierungen**, dann **Neue Registrierung**.
3. Ausfüllen:
   - **Name:** `XrmForge Type Generator` (oder ein beliebiger Name)
   - **Unterstützte Kontotypen:** Einzelner Mandant (nur eigene Organisation)
   - **Redirect-URI:** "Mobile and desktop applications" auswählen und `http://localhost` eingeben (erforderlich für interaktive Authentifizierung)
4. Auf **Registrieren** klicken.
5. Auf der App-Übersichtsseite kopieren:
   - **Anwendungs-(Client-)ID** -- das ist dein `--client-id`
   - **Verzeichnis-(Mandanten-)ID** -- das ist dein `--tenant-id`
6. Zu **API-Berechtigungen** gehen, auf **Berechtigung hinzufügen** klicken.
   - **Dynamics CRM** auswählen.
   - **user_impersonation** aktivieren.
   - Auf **Berechtigungen hinzufügen** klicken.
   - Bei Administratorrechten auf **Administratorzustimmung erteilen** klicken (andernfalls den Administrator bitten).
7. Für CI/CD mit `client-credentials`:
   - Zu **Zertifikate und Geheimnisse** gehen, auf **Neues Clientgeheimnis** klicken.
   - Den Geheimniswert sofort kopieren (er wird nur einmal angezeigt).
   - Sicher aufbewahren (z.B. Azure Key Vault, GitHub-Actions-Secret).
   - Der Service Principal benötigt ausserdem einen Anwendungsbenutzer in Dataverse mit der Rolle "Systemadministrator".

### Konfigurationsdatei

Statt alle Flags auf der Kommandozeile anzugeben, kann `xrmforge.config.json` im Projektstamm erstellt werden:

```json
{
  "url": "https://myorg.crm4.dynamics.com",
  "auth": "interactive",
  "tenantId": "YOUR_TENANT_ID",
  "clientId": "YOUR_APP_ID",
  "entities": ["account", "contact", "opportunity"],
  "output": "./generated",
  "labelLanguage": 1033,
  "secondaryLanguage": 1031
}
```

CLI-Flags haben immer Vorrang vor Werten in der Konfigurationsdatei. `clientSecret` niemals in diese Datei schreiben; stattdessen Umgebungsvariablen verwenden.

Mit einer Konfigurationsdatei vereinfacht sich die Generierung auf:

```bash
npx xrmforge generate
```

---

## 7. Generierte Typen verwenden

### tsconfig.json

Eine funktionsfähige `tsconfig.json` für D365-Projekte:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "types": ["xrm"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": false
  },
  "include": [
    "src/**/*.ts",
    "generated/**/*.ts"
  ]
}
```

Wichtige Punkte:

- `"types": ["xrm"]` lädt den globalen `Xrm`-Namespace aus `@types/xrm`.
- `"strict": true` aktiviert alle strikten Prüfungen. Hier zeigt XrmForge seine Stärke.
- Das `include`-Array muss sowohl den Quellcode als auch die generierten Typen abdecken.

### Ein Formularskript schreiben

Ein vollständiges, realistisches Formularskript:

```typescript
// src/forms/account-form.ts

// Formular-Interface importieren (pro Formular generiert)
import type { AccountAccountForm as AccountForm } from '../../generated/forms/account.js';

// Fields-Enum: Autovervollständigung zeigt alle Felder auf diesem Formular mit zweisprachigen Labels
import { AccountAccountFormFieldsEnum as Fields } from '../../generated/forms/account.js';

// OptionSet-Enum (aus Auswahllisten-Metadaten generiert)
import { IndustryCode } from '../../generated/optionsets/account.js';

/**
 * onLoad-Handler für das Account-Hauptformular.
 * In D365 registrieren als: Contoso.AccountForm.onLoad
 */
export function onLoad(executionContext: Xrm.Events.EventContext): void {
  const formContext = executionContext.getFormContext() as AccountForm;

  // getAttribute gibt den exakten Typ basierend auf dem Feld zurück:
  const name = formContext.getAttribute(Fields.AccountName);
  // TypeScript weiß: Xrm.Attributes.StringAttribute

  const creditLimit = formContext.getAttribute(Fields.CreditLimit);
  // TypeScript weiß: Xrm.Attributes.NumberAttribute

  const creditHold = formContext.getAttribute(Fields.CreditHold);
  // TypeScript weiß: Xrm.Attributes.BooleanAttribute

  const primaryContact = formContext.getAttribute(Fields.PrimaryContact);
  // TypeScript weiß: Xrm.Attributes.LookupAttribute

  // Kompilierfehler fangen Fehler ab:
  // name.setValue(123);                   // Fehler: number ist nicht string zuweisbar
  // formContext.getAttribute("naem");     // Fehler: "naem" ist nicht in der Felder-Union

  // Geschäftslogik mit vollständiger Typsicherheit
  if (creditHold.getValue() === true) {
    const creditControl = formContext.getControl(Fields.CreditLimit);
    // TypeScript weiß: Xrm.Controls.NumberControl
    creditControl.setDisabled(true);
  }
}
```

### Web-API-Abfragen mit Fields-Enum

Der `select()`-Helfer und das entity-weite `Fields`-Enum ermöglichen typsichere Web-API-Abfragen:

```typescript
import { select, parseLookup, parseFormattedValue } from '@xrmforge/helpers';
import { AccountFields } from '../../generated/fields/account.js';
import { AccountNavigationProperties as AccountNav } from '../../generated/entities/account.js';

async function loadAccountData(accountId: string): Promise<void> {
  // select() erstellt den OData-$select-Abfragestring
  const result = await Xrm.WebApi.retrieveRecord(
    "account",
    accountId,
    select(
      AccountFields.Name,
      AccountFields.Website,
      AccountFields.CreditLimit,
      AccountFields.PrimaryContact,
    ),
  );

  // Lookup-Felder aus der Antwort parsen
  const contact = parseLookup(result, AccountNav.PrimaryContact);
  if (contact) {
    console.log(`Primärkontakt: ${contact.name} (${contact.entityType})`);
  }

  // Formatierte Werte parsen (Anzeigenamen für OptionSets, Datumsangaben, Geldbeträge)
  const industry = parseFormattedValue(result, "industrycode");
  // "Consulting" statt 7
}
```

### Custom-Action-Executors

XrmForge generiert typsichere Executors für Custom APIs, die in der Dataverse-Umgebung definiert sind:

```typescript
// Den generierten Executor importieren
import { NormalizePhone } from '../generated/actions/global';
import type { ContactContactForm } from '../generated/forms/contact.js';

async function normalizePhoneNumber(
  formContext: ContactContactForm,
): Promise<void> {
  const phone = formContext.getAttribute("telephone1").getValue();
  if (!phone) return;

  // Typsicher: TypeScript kennt die Parameter- und Antwortstruktur
  const result = await NormalizePhone.execute({
    Input: phone,
    AllowSuspicious: false,
  });

  // result.Normalized, result.Status, result.Message sind alle typisiert
  if (result.Status === 1) {
    formContext.getAttribute("telephone1").setValue(result.Normalized);
  }
}
```

Für gebundene Aktionen (Aktionen, die an eine bestimmte Entity gebunden sind):

```typescript
import { WinQuote } from '../generated/actions/quote';
import { withProgress } from '@xrmforge/helpers';

async function winQuote(quoteId: string): Promise<void> {
  // withProgress zeigt einen Spinner und behandelt Fehler mit einem Dialog
  await withProgress("Angebot wird verarbeitet...", () =>
    WinQuote.execute(quoteId),
  );
}
```

### Einen Power-Automate-Cloud-Flow aufrufen

`callCloudFlow()` ist ein typisierter Wrapper für einen Cloud-Flow mit HTTP-Request-Trigger. Der Body wird als JSON gesendet, die Antwort geparst zurückgegeben, und bei Nicht-2xx-Status wird geworfen. Die Trigger-URL enthält eine SAS-Signatur, also als Parameter aus der Konfiguration übergeben, nicht hardcoden. Für einen Spinner mit `withProgress` kombinieren. (Für einen über eine Custom Action erreichten Flow stattdessen `createUnboundAction` verwenden.)

```typescript
import { callCloudFlow, withProgress } from '@xrmforge/helpers';

interface PriceRequest { quoteId: string; }
interface PriceResponse { total: number; currency: string; }

const price = await withProgress('Preis wird berechnet...', () =>
  callCloudFlow<PriceRequest, PriceResponse>(FLOW_URL, { quoteId }),
);
console.log(price.total, price.currency);
```

---

## 8. Für D365 bauen

### Warum IIFE?

Dynamics 365 lädt Web Resources über `<script>`-Tags. Funktionen müssen global zugänglich sein, damit das Formular-Event-Handler-System sie per Name aufrufen kann (z.B. `Contoso.AccountForm.onLoad`). Das IIFE-Format (Immediately Invoked Function Expression) kapselt den Modulcode und stellt ihn unter einem globalen Namespace bereit.

### Option A: `xrmforge build` (empfohlen)

Eine `build`-Sektion in `xrmforge.config.json` hinzufügen:

```json
{
  "build": {
    "outDir": "./dist/contoso_/JS",
    "target": "es2020",
    "sourcemap": true,
    "minify": true,
    "entries": {
      "account_form": {
        "input": "./src/forms/account-form.ts",
        "namespace": "Contoso.AccountForm",
        "out": "Account/OnLoad.js"
      },
      "contact_form": {
        "input": "./src/forms/contact-form.ts",
        "namespace": "Contoso.ContactForm",
        "out": "Contact/OnLoad.js"
      },
      "shared_notifications": {
        "input": "./src/shared/notifications.ts",
        "namespace": "Contoso.Shared",
        "out": "Shared/Notifications.js"
      }
    }
  }
}
```

Dann bauen:

```bash
xrmforge build            # Alle Entries bauen (parallel, IIFE-Bundles)
xrmforge build --watch    # Watch-Modus (~10ms inkrementelle Rebuilds)
xrmforge build --minify   # Überschreibung: Ausgabe minimieren
xrmforge build --no-sourcemap  # Überschreibung: Source Maps deaktivieren
```

Keine `build.mjs`, keine `esbuild.config.ts`, keine direkte esbuild-Abhängigkeit nötig. Das `@xrmforge/devkit`-Paket übernimmt alles.

### Option B: Manuelles build.mjs

Wer volle Kontrolle über esbuild behalten möchte, kann `build.mjs` im Projektstamm erstellen:

```javascript
import * as esbuild from "esbuild";

const webResources = [
  {
    entry: "src/forms/account-form.ts",
    globalName: "Contoso.AccountForm",
    out: "contoso_/JS/Account/OnLoad.js",
  },
];

for (const wr of webResources) {
  await esbuild.build({
    entryPoints: [wr.entry],
    bundle: true,
    format: "iife",
    globalName: wr.globalName,
    outfile: `dist/${wr.out}`,
    target: ["es2020"],
    minify: true,
    sourcemap: true,
  });
}
```

### package.json-Skripte

```json
{
  "scripts": {
    "generate": "xrmforge generate",
    "typecheck": "tsc --noEmit",
    "build": "xrmforge build",
    "watch": "xrmforge build --watch"
  }
}
```

### Gemeinsame Bibliotheken

Wenn mehrere Formularskripte dieselben Hilfsfunktionen verwenden (z.B. Benachrichtigungshelfer, DSGVO-Logik, Validierung), diese in eine gemeinsame Bibliothek auslagern:

1. `src/shared/notifications.ts` mit dem gemeinsamen Code erstellen.
2. Als Entry in `xrmforge.config.json` mit eigenem `namespace` (z.B. `Contoso.Shared`) hinzufügen.
3. In Formularskripten auf gemeinsame Funktionen über den globalen Namespace zugreifen: `Contoso.Shared.showNotification(...)`.
4. In D365 die gemeinsame `.js`-Datei als Web Resource hochladen.
5. Bei jedem Formular, das sie verwendet, die gemeinsame Web Resource als **Abhängigkeit** hinzufügen (Formulareigenschaften, dann Ereignishandler, dann Abhängigkeiten). Dadurch stellt D365 sicher, dass die gemeinsame Bibliothek vor dem Formularskript geladen wird.

Dieses Muster vermeidet die Duplizierung von Code über mehrere Bundles.

---

## 9. In D365 deployen

### Automatisiertes Deployment (empfohlen)

XrmForge enthält ein Deploy-Script das WebResources direkt über die Dataverse Web API nach D365 pusht. Keine externen Tools nötig (kein spkl, kein XrmToolBox, kein manuelles Hochladen).

**Einrichtung:** Umgebungsvariablen für die Zielumgebung setzen:

```bash
export DATAVERSE_URL=https://myorg.crm4.dynamics.com
export AZURE_TENANT_ID=deine-tenant-id
```

Das Deploy-Script nutzt `@azure/identity` (MSAL) für die Authentifizierung. Beim ersten Aufruf öffnet sich ein Browser zur interaktiven Anmeldung. Tokens werden automatisch gecacht und erneuert, kein manuelles Copy-Paste nötig. Für CI/CD `AZURE_CLIENT_SECRET` setzen um Client Credentials zu verwenden.

**Deploy-Befehle:**

```bash
npm run deploy          # Build + geänderte WebResources deployen
npm run deploy:dry      # Build + anzeigen was deployed würde (keine Änderungen)
npm run deploy:force    # Build + ALLE WebResources neu deployen (Hashes ignorieren)
npm run deploy:maps     # Build + mit Source Maps deployen (für Debugging)
```

Das Deploy-Script arbeitet **inkrementell**: Es verfolgt SHA-256-Hashes der deployten Dateien und lädt nur WebResources hoch die sich tatsächlich geändert haben. Ein vollständiges Deployment von 7 WebResources dauert etwa 3 Sekunden.

**So funktioniert es:**

1. Liest gebaute `.js`-Dateien aus `dist/`
2. Vergleicht SHA-256-Hashes mit `.deploy-hashes.json` (lokaler Stand)
3. Base64-kodiert geänderte Dateien
4. Erstellt oder aktualisiert WebResources per `POST`/`PATCH` auf `webresourceset`
5. Veröffentlicht alle geänderten Ressourcen per `PublishXml`

### Manuelles Hochladen (Alternative)

Wenn manuelles Deployment bevorzugt wird: in der D365-Lösung zu Web Resources gehen, die `.js`-Dateien aus `dist/` hochladen und veröffentlichen.

**Namenskonvention:** `publisherprefix_/JS/Entity/Handler.js`, z.B. `contoso_/JS/Account/OnLoad.js`.

### Formular-Ereignishandler registrieren

1. Das Formular im Formulardesigner öffnen.
2. Zu **Formulareigenschaften** gehen, dann **Ereignishandler**.
3. Einen Handler hinzufügen. Funktionsnamen als `globalName.exportedFunction` eingeben, z.B.: `Contoso.Account.onLoad`.
4. Gemeinsame Bibliotheken als **Abhängigkeiten** hinzufügen, damit sie zuerst geladen werden.

---

## 10. Debugging

### Source Maps

Mit aktivierten Source Maps bauen (Standard in `build.mjs`). Für die Entwicklung können eingebettete Source Maps verwendet werden (esbuild-Option `sourcemap: 'inline'`), damit nur eine Datei hochgeladen werden muss.

### Browser-DevTools

1. Das Formular in D365 öffnen.
2. F12 drücken, um die DevTools zu öffnen.
3. Strg+P (Cmd+P auf Mac) drücken und nach dem `.ts`-Dateinamen suchen.
4. Haltepunkte im originalen TypeScript-Quellcode setzen.

### Fiddler oder Charles Proxy

Für eine schnelle Entwicklungsschleife ohne erneutes Hochladen von Web Resources:

1. Eine Proxy-Regel einrichten, die die Web-Resource-URL auf eine lokale Datei auf dem Rechner umleitet.
2. `npm run watch` ausführen, damit esbuild bei jedem Speichern neu baut.
3. Das D365-Formular aktualisieren. Der Browser lädt die lokale Datei über den Proxy.

Das ermöglicht nahezu sofortiges Feedback: Datei speichern, Formular aktualisieren, Änderungen sehen.

### Häufige DevTools-Tipps

- Den **Konsole**-Tab verwenden, um `console.log`-Ausgaben aus den Formularskripten zu sehen.
- Den **Netzwerk**-Tab verwenden, um Web-API-Aufrufe von `Xrm.WebApi` zu untersuchen.
- Das `Xrm`-Objekt ist in der Konsole verfügbar. Aufrufe können interaktiv getestet werden: `Xrm.Page.getAttribute("name").getValue()`. Hinweis: `Xrm.Page` ist deprecated und nur in der Konsole zum Debuggen geeignet. In Produktionscode immer `executionContext.getFormContext()` verwenden.

---

## 11. Häufige Muster

### Lookup-Werte

Lookup-Felder aus Web-API-Antworten in `Xrm.LookupValue`-Objekte parsen:

```typescript
import { parseLookup } from '@xrmforge/helpers';
import { AccountNavigationProperties as AccountNav } from '../../generated/entities/account.js';
import { AccountAccountFormFieldsEnum as Fields } from '../../generated/forms/account.js';

// Ein Account über die Web API abrufen
const result = await Xrm.WebApi.retrieveRecord("account", accountId, "?$select=_primarycontactid_value");

// Den Lookup parsen
const contact = parseLookup(result, AccountNav.PrimaryContact);
if (contact) {
  formContext.getAttribute(Fields.PrimaryContact).setValue([{
    id: contact.id,
    name: contact.name,
    entityType: contact.entityType,
  }]);
}
```

### Formularbenachrichtigungen

Die Konstante `FormNotificationLevel` statt roher Strings verwenden:

```typescript
import { FormNotificationLevel } from '@xrmforge/helpers';

formContext.ui.setFormNotification(
  "Record saved successfully.",
  FormNotificationLevel.Info,
  "save-notification",
);

// Benachrichtigung nach 5 Sekunden entfernen
setTimeout(() => {
  formContext.ui.clearFormNotification("save-notification");
}, 5000);
```

### Tab-Anzeigestatus

```typescript
import { DisplayState } from '@xrmforge/helpers';

const summaryTab = formContext.ui.tabs.get("SUMMARY_TAB");
if (summaryTab.getDisplayState() === DisplayState.Collapsed) {
  summaryTab.setDisplayState(DisplayState.Expanded);
}
```

### Fortschrittsanzeige

Asynchrone Operationen mit einem Fortschrittsspinner und automatischem Fehlerdialog umschließen:

```typescript
import { withProgress } from '@xrmforge/helpers';
import { WinQuote } from '../generated/actions/quote';

await withProgress("Angebot wird verarbeitet...", () =>
  WinQuote.execute(quoteId),
);
// Spinner schließt automatisch. Bei Fehler wird ein Fehlerdialog angezeigt.
```

### Pflichtfeldstatus

```typescript
import { RequiredLevel } from '@xrmforge/helpers';

// E-Mail als Pflichtfeld setzen, wenn "Bevorzugte Kontaktmethode" E-Mail ist
formContext
  .getAttribute(Fields.Email)
  .setRequiredLevel(RequiredLevel.Required);
```

### Übergabemodus

```typescript
import { SubmitMode } from '@xrmforge/helpers';

// Dieses Feld immer übertragen, auch wenn es unverändert ist
formContext
  .getAttribute(Fields.ModifiedReason)
  .setSubmitMode(SubmitMode.Always);
```

### Speichermodus

```typescript
import { SaveMode } from '@xrmforge/helpers';

export function onSave(executionContext: Xrm.Events.SaveEventContext): void {
  const saveMode = executionContext.getEventArgs().getSaveMode();

  if (saveMode === SaveMode.SaveAndClose) {
    // Benutzerdefinierte Validierung vor dem Speichern und Schließen
  }
}
```

### Batch-Ausführung (executeMultiple)

`.request()` verwenden, um Anforderungsobjekte zu erstellen und in einem einzigen Batch auszuführen:

```typescript
import { executeMultiple } from '@xrmforge/helpers';
import { ApproveRecord } from '../generated/actions/global';
import { NotifyOwner } from '../generated/actions/global';

const requests = [
  ApproveRecord.request({ RecordId: recordId }),
  NotifyOwner.request({ RecordId: recordId, Message: "Approved" }),
];

// Beide in einem einzigen Round-Trip ausführen
const responses = await executeMultiple(requests);
```

### Formularskripte testen (NEU in v0.2.0)

`@xrmforge/testing` erzeugt typsichere Mock-Objekte aus generierten Formular-Interfaces. Kein `as any` mehr, kein manuelles `XrmMockGenerator.Attribute.createString("name", ...)`:

```typescript
import { describe, it, expect } from 'vitest';
import { createFormMock } from '@xrmforge/testing';

import type { AccountMainForm as AccountForm, AccountMainFormMockValues as MockValues } from '../../generated/forms/account.js';

describe('Account onLoad', () => {
  it('sollte MPK-Feld sperren wenn Wert gesetzt', () => {
    const mock = createFormMock<AccountForm>({
      markant_ismpk: 1,  // Compile-Fehler bei falschem Typ
    } satisfies MockValues);

    if (mock.getValue('markant_ismpk') === 0 || mock.getValue('markant_ismpk') === 1) {
      mock.getControl('markant_ismpk').setDisabled(true);
    }

    expect(mock.getControl('markant_ismpk').getDisabled()).toBe(true);
  });

  it('sollte EventContext für onLoad-Handler bereitstellen', () => {
    const mock = createFormMock<AccountForm>(
      { name: 'Contoso' } satisfies MockValues,
      { entityName: 'account', entityId: 'abc-123' },
    );

    const ctx = mock.asEventContext();
    const fc = ctx.getFormContext() as AccountForm;
    expect(fc.getAttribute('name').getValue()).toBe('Contoso');
  });
});
```

Installation: `npm install -D @xrmforge/testing`

---

## 12. Pakete

| Paket | Beschreibung | Status |
|---------|-------------|--------|
| `@xrmforge/typegen` | Kern-Engine: Metadaten, Typgenerierung, Web-API-Helfer, Xrm-Konstanten, Action-Runtime, MockValues-Typen, inkrementelle Generierung mit Metadata-Cache | v0.6.0 |
| `@xrmforge/testing` | Typsicherer Formular-Mock-Builder: `createFormMock()`, `fireOnChange()`, MockAttribute, MockControl, MockUi | v0.2.0 |
| `@xrmforge/cli` | Kommandozeile: `generate` (mit `--cache`), `build` (mit `--watch`) | v0.4.2 |
| `@xrmforge/webapi` | Typsicherer Web-API-Client: `retrieve<T>()`, `retrieveMultiple<T>()`, `create()`, `update()`, `remove()`, QueryBuilder | v0.1.0 |
| `@xrmforge/helpers` | Browser-safe Runtime: `select()`, `parseLookup()`, `typedForm()`, Xrm-Konstanten, Action/Function Executors | v0.1.0 |
| `@xrmforge/devkit` | Build-Orchestrierung: esbuild IIFE-Bundles für D365 WebResources, `xrmforge build`, Watch-Modus | v0.4.0 |
| `@xrmforge/pipeline` | CI/CD-Vorlagen für Azure DevOps und GitHub Actions | Geplant |
| `@xrmforge/eslint-plugin` | D365-spezifische ESLint-Regeln: keine rohen `getAttribute`-Strings, keine magischen Zahlen für OptionSets, kein `Xrm.Page` | v0.2.0 |

---

## 13. Für Framework-Entwickler

Wer zu XrmForge selbst beitragen oder auf dessen Interna aufbauen möchte:

```bash
git clone https://github.com/juergenbeck/XrmForge.git
cd XrmForge
pnpm install
pnpm build
pnpm test       # 699 Tests über 7 Pakete
pnpm typecheck  # TypeScript Strict Mode
pnpm lint       # ESLint v9
```

Das Projekt verwendet:

- **pnpm** (v9+) als Paketmanager
- **Turborepo** für Monorepo-Build-Orchestrierung
- **Vitest** zum Testen
- **tsup** (esbuild-basiert) zum Bauen der Pakete
- **Changesets** für Versionierung und Changelog-Generierung
- **TypeScript Strict Mode** in allen Paketen
- **ESM only** (`"type": "module"`)

Commit-Konventionen, PR-Checkliste und Code-Qualitätsstandards sind in [CONTRIBUTING.md](CONTRIBUTING.md) beschrieben.

---

## 14. Fehlerbehebung

**"Cannot find namespace 'Xrm'"**

Die Xrm-Typdefinitionen installieren:

```bash
npm install --save-dev @types/xrm
```

Und sicherstellen, dass `tsconfig.json` `"types": ["xrm"]` enthält.

**"Cannot find namespace 'XrmForge'"**

Prüfen, ob das `include`-Array in `tsconfig.json` die generierten Dateien abdeckt:

```json
"include": [
  "src/**/*.ts",
  "generated/**/*.ts"
]
```

Ausserdem sicherstellen, dass das `--output`-Verzeichnis mit dem Pfad in `include` übereinstimmt.

**VS Code zeigt Fehler, aber `tsc` besteht (oder umgekehrt)**

VS Code führt einen eigenen TypeScript-Server aus. Folgendes versuchen:

1. Strg+Umschalt+P drücken, dann "TypeScript: Restart TS Server".
2. Prüfen, ob die TypeScript-Version in der VS-Code-Statusleiste zum Projekt passt (auf die Versionsnummer klicken, um zu wechseln).
3. Sicherstellen, dass keine doppelte `tsconfig.json` den TS-Server verwirrt.

**Authentifizierung schlägt fehl mit "AADSTS..."**

- Prüfen, ob die App-Registrierung die Berechtigung **Dynamics CRM / user_impersonation** hat.
- Bei `client-credentials` sicherstellen, dass die Administratorzustimmung erteilt wurde und der Service Principal einen Dataverse-Anwendungsbenutzer mit geeigneten Sicherheitsrollen hat.
- Prüfen, ob `--tenant-id` und `--client-id` mit den Werten aus dem Azure-Portal übereinstimmen.
- Bei interaktiver Authentifizierung sicherstellen, dass die Redirect-URI `http://localhost` in der App-Registrierung konfiguriert ist.

**esbuild-Fehler "Could not resolve"**

Wenn esbuild einen Import nicht auflösen kann:

- Für `@xrmforge/helpers`-Laufzeithelfer (wie `createUnboundAction`) sicherstellen, dass `@xrmforge/helpers` in `dependencies` steht (nicht nur in `devDependencies`), da die generierten Action-`.ts`-Dateien zur Laufzeit daraus importieren.
- Seit v0.8.0 sind alle generierten Dateien `.ts`-Module. Reine Typ-Imports (`import type { ... }`) werden zur Laufzeit entfernt und haben keinen Einfluss auf das Bundle.

**Generierung erfolgreich, aber Dateien sind leer oder unvollständig**

- Prüfen, ob der authentifizierte Benutzer Lesezugriff auf die Entity-Metadaten hat. Eine eingeschränkte Sicherheitsrolle kann einige Entities oder Attribute verbergen.
- `--verbose` für detailliertes Logging verwenden, das jede Metadatenanfrage und -antwort zeigt.

---

## 15. Roadmap

### Ausgeliefert

- **`@xrmforge/testing`** (v0.1.1) -- Typsicherer Formular-Mock-Builder mit Compile-Time-Feldvalidierung.
- **`@xrmforge/webapi`** (v0.1.0) -- Typsicherer Web-API-Client: `retrieve<T>()`, `retrieveMultiple<T>()`, `create()`, `update()`, `remove()`, QueryBuilder mit Pagination.
- **`@xrmforge/helpers`** (v0.1.0) -- Browser-safe Runtime: select(), parseLookup(), typedForm(), Xrm-Konstanten, Action/Function Executors.
- **`@xrmforge/devkit`** (v0.1.0) -- Build-Orchestrierung: `xrmforge build` mit IIFE-Bundles, Watch-Modus, deklarativer Config.
- **`@xrmforge/eslint-plugin`** (v0.2.0) -- D365-spezifische ESLint-Regeln: keine rohen `getAttribute`-Strings, keine magischen Zahlen für OptionSets, kein `Xrm.Page`.
- **Custom-API-Live-Generierung** -- `--actions` generiert typisierte Executors. `--actions-filter` für Prefix-Filterung.
- **Lösungsbasierte Erkennung** -- `--solutions Sales,Service` erkennt Entities aus Dataverse-Lösungen automatisch.
- **Inkrementelle Generierung** -- `--cache` aktiviert Metadata-Caching mit Delta-Erkennung per `RetrieveMetadataChanges`. 10x schneller bei Folge-Läufen.

### Geplant

- **`xrmforge init`** -- Projekt-Scaffolding: tsconfig-Vorlagen, Build-Konfiguration, Beispielprojekte.
- **`@xrmforge/pipeline`** -- CI/CD-Pipeline-Vorlagen für Azure DevOps (YAML) und GitHub Actions.
- **webpack-Unterstützung** -- Tier-2-Bundler für Teams mit bestehendem webpack-Setup.

---

## 16. Lizenz

[MIT](LICENSE)

Copyright (c) 2026 XrmForge Contributors.
