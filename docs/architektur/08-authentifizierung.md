# 8. Authentifizierung

## 8.1 Credential Factory

`createCredential(config: AuthConfig)` gibt ein `TokenCredential` (aus @azure/identity) basierend auf der Authentifizierungsmethode zurück:

## 8.2 Vier Authentifizierungsabläufe

| Methode | Konfiguration | @azure/identity-Klasse | Anwendungsfall |
|---------|---------------|------------------------|----------------|
| client-credentials | tenantId, clientId, clientSecret | ClientSecretCredential | CI/CD, automatisierte Pipelines |
| interactive | tenantId, clientId? | InteractiveBrowserCredential | Entwickler-Arbeitsplatz |
| device-code | tenantId, clientId? | DeviceCodeCredential | Headless-CLI-Umgebungen |
| token | token (string) | StaticTokenCredential | Vorab erworbene Tokens (z.B. aus TokenVault) |

## 8.3 Token-Scope

Alle Authentifizierungsabläufe fordern den Scope an: `{environmentUrl}/.default`
