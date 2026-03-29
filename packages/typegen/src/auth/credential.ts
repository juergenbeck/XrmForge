/**
 * @xrmforge/typegen - Authentication Module
 *
 * Handles authentication to Dataverse Web API using MSAL (@azure/identity).
 * Supports: Client Credentials (Service Principal), Interactive Browser, Device Code.
 *
 * Token acquisition and caching is handled by the DataverseHttpClient.
 * This module is responsible only for creating the correct TokenCredential.
 */

import {
  ClientSecretCredential,
  InteractiveBrowserCredential,
  DeviceCodeCredential,
  type TokenCredential,
} from '@azure/identity';
import { AuthenticationError, ErrorCode } from '../errors.js';
import { createLogger } from '../logger.js';

const log = createLogger('auth');

// ─── Configuration Types ─────────────────────────────────────────────────────

export type AuthMethod = 'client-credentials' | 'interactive' | 'device-code' | 'token';

export interface ClientCredentialsAuth {
  method: 'client-credentials';
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface InteractiveAuth {
  method: 'interactive';
  tenantId?: string;
  clientId?: string;
}

export interface DeviceCodeAuth {
  method: 'device-code';
  tenantId?: string;
  clientId?: string;
}

export interface TokenAuth {
  method: 'token';
  /** Pre-acquired Bearer token (e.g. from TokenVault, Key Vault, CI/CD secret) */
  token: string;
}

export type AuthConfig = ClientCredentialsAuth | InteractiveAuth | DeviceCodeAuth | TokenAuth;

/**
 * Default App ID provided by Microsoft for dev/prototyping scenarios.
 * For production, create a dedicated App Registration in Azure AD.
 * @see https://learn.microsoft.com/en-us/power-apps/developer/data-platform/xrm-tooling/use-connection-strings-xrm-tooling-connect
 */
const DEFAULT_CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';

// ─── Credential Factory ──────────────────────────────────────────────────────

/**
 * Creates an Azure Identity TokenCredential from the provided auth configuration.
 * Validates required fields before attempting credential creation.
 *
 * @throws {AuthenticationError} if required configuration values are missing
 */
export function createCredential(config: AuthConfig): TokenCredential {
  switch (config.method) {
    case 'client-credentials':
      return createClientCredential(config);

    case 'interactive':
      return createInteractiveCredential(config);

    case 'device-code':
      return createDeviceCodeCredential(config);

    case 'token':
      return createStaticTokenCredential(config);

    default: {
      // Exhaustiveness check: this should never happen with proper TypeScript usage
      const exhaustiveCheck: never = config;
      throw new AuthenticationError(
        ErrorCode.AUTH_MISSING_CONFIG,
        `Unknown authentication method: "${(exhaustiveCheck as AuthConfig).method}". ` +
          `Supported methods: client-credentials, interactive, device-code.`,
      );
    }
  }
}

// ─── Internal Credential Builders ────────────────────────────────────────────

function createClientCredential(config: ClientCredentialsAuth): TokenCredential {
  const missing: string[] = [];
  if (!config.tenantId?.trim()) missing.push('tenantId');
  if (!config.clientId?.trim()) missing.push('clientId');
  if (!config.clientSecret?.trim()) missing.push('clientSecret');

  if (missing.length > 0) {
    throw new AuthenticationError(
      ErrorCode.AUTH_MISSING_CONFIG,
      `Client credentials authentication requires: ${missing.join(', ')}. ` +
        `These can be set in xrmforge.config.json or via environment variables ` +
        `(XRMFORGE_TENANT_ID, XRMFORGE_CLIENT_ID, XRMFORGE_CLIENT_SECRET).`,
      { missingFields: missing },
    );
  }

  log.debug('Creating client credentials (Service Principal)', {
    tenantId: config.tenantId,
    clientId: config.clientId,
  });

  return new ClientSecretCredential(config.tenantId, config.clientId, config.clientSecret);
}

function createInteractiveCredential(config: InteractiveAuth): TokenCredential {
  const clientId = config.clientId?.trim() || DEFAULT_CLIENT_ID;

  log.debug('Creating interactive browser credential', {
    clientId,
    tenantId: config.tenantId ?? 'common',
    usingDefaultClientId: !config.clientId,
  });

  return new InteractiveBrowserCredential({
    tenantId: config.tenantId,
    clientId,
  });
}

function createDeviceCodeCredential(config: DeviceCodeAuth): TokenCredential {
  const clientId = config.clientId?.trim() || DEFAULT_CLIENT_ID;

  log.debug('Creating device code credential', {
    clientId,
    tenantId: config.tenantId ?? 'common',
    usingDefaultClientId: !config.clientId,
  });

  return new DeviceCodeCredential({
    tenantId: config.tenantId,
    clientId,
    userPromptCallback: (info) => {
      log.info('Device Code Authentication required:');
      log.info(info.message);
    },
  });
}

function createStaticTokenCredential(config: TokenAuth): TokenCredential {
  if (!config.token?.trim()) {
    throw new AuthenticationError(
      ErrorCode.AUTH_MISSING_CONFIG,
      'Token authentication requires a non-empty token. ' +
        'Set XRMFORGE_TOKEN environment variable or use --token flag.',
    );
  }

  log.debug('Using pre-acquired token (static credential)');

  return new StaticTokenCredential(config.token);
}

// ─── Static Token Credential ────────────────────────────────────────────────

/**
 * A TokenCredential that wraps a pre-acquired Bearer token.
 * Useful for integration with external token sources like:
 * - Markant TokenVault (Get-VaultToken -System 'dataverse_dev')
 * - Azure Key Vault
 * - CI/CD pipeline secrets
 *
 * Note: This credential does NOT handle token refresh. If the token expires,
 * the next API call will fail with HTTP 401.
 */
export class StaticTokenCredential implements TokenCredential {
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  async getToken(): Promise<{ token: string; expiresOnTimestamp: number }> {
    // Return the static token with a far-future expiry.
    // The HttpClient's 401-retry logic will clear the cache and call getToken again,
    // but since we have no refresh mechanism, it will return the same (possibly expired) token.
    return {
      token: this.token,
      expiresOnTimestamp: Date.now() + 60 * 60 * 1000, // Pretend 1 hour validity
    };
  }
}

