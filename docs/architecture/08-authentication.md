# Authentication

### 8.1 Credential Factory

`createCredential(config: AuthConfig)` returns a `TokenCredential` (from @azure/identity) based on the auth method:

### 8.2 Four Auth Flows

| Method | Config | @azure/identity Class | Use Case |
|--------|--------|-----------------------|----------|
| client-credentials | tenantId, clientId, clientSecret | ClientSecretCredential | CI/CD, automated pipelines |
| interactive | tenantId, clientId? | InteractiveBrowserCredential | Developer workstation |
| device-code | tenantId, clientId? | DeviceCodeCredential | Headless CLI environments |
| token | token (string) | StaticTokenCredential | Pre-acquired tokens (e.g. from TokenVault) |

### 8.3 Token Scope

All auth flows request the scope: `{environmentUrl}/.default`
