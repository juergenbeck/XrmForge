import { describe, it, expect } from 'vitest';
import { mergeWithCliOptions, applyEnvDefaults } from '../src/config.js';

describe('mergeWithCliOptions', () => {
  // ─── actions (boolean) ─────────────────────────────────────────────────────

  it('reads actions from config when the CLI does not set it', () => {
    const merged = mergeWithCliOptions({ actions: true }, {});
    expect(merged['actions']).toBe(true);
  });

  it('lets a CLI --actions value take precedence over config', () => {
    const merged = mergeWithCliOptions({ actions: false }, { actions: true });
    expect(merged['actions']).toBe(true);
  });

  it('leaves actions undefined when neither CLI nor config set it', () => {
    const merged = mergeWithCliOptions({}, {});
    expect(merged['actions']).toBeUndefined();
  });

  // ─── actionsFilter (string) ────────────────────────────────────────────────

  it('reads actionsFilter from config when the CLI does not set it', () => {
    const merged = mergeWithCliOptions({ actionsFilter: 'lm_' }, {});
    expect(merged['actionsFilter']).toBe('lm_');
  });

  it('lets a CLI --actions-filter value take precedence over config', () => {
    const merged = mergeWithCliOptions({ actionsFilter: 'lm_' }, { actionsFilter: 'markant_' });
    expect(merged['actionsFilter']).toBe('markant_');
  });

  // ─── regression: existing fields still merge ───────────────────────────────

  it('still merges existing config fields (output, entities)', () => {
    const merged = mergeWithCliOptions(
      { output: './gen', entities: ['account', 'contact'] },
      {},
    );
    expect(merged['output']).toBe('./gen');
    expect(merged['entities']).toBe('account,contact');
  });
});

describe('applyEnvDefaults', () => {
  const FULL_ENV = {
    XRMFORGE_URL: 'https://env.crm4.dynamics.com',
    XRMFORGE_TENANT_ID: 'env-tid',
    XRMFORGE_CLIENT_ID: 'env-cid',
    XRMFORGE_CLIENT_SECRET: 'env-secret',
    XRMFORGE_TOKEN: 'env-token',
  };

  // ─── fills from env when the CLI did not set a value ───────────────────────

  it('fills all connection/credential options from XRMFORGE_* env vars', () => {
    const result = applyEnvDefaults({}, FULL_ENV);
    expect(result['url']).toBe('https://env.crm4.dynamics.com');
    expect(result['tenantId']).toBe('env-tid');
    expect(result['clientId']).toBe('env-cid');
    expect(result['clientSecret']).toBe('env-secret');
    expect(result['token']).toBe('env-token');
  });

  // ─── precedence: CLI flag wins over env var ────────────────────────────────

  it('lets an explicit CLI value take precedence over the env var', () => {
    const result = applyEnvDefaults(
      { clientSecret: 'flag-secret', url: 'https://flag.crm4.dynamics.com' },
      FULL_ENV,
    );
    expect(result['clientSecret']).toBe('flag-secret');
    expect(result['url']).toBe('https://flag.crm4.dynamics.com');
    // unset flags still come from the environment
    expect(result['tenantId']).toBe('env-tid');
  });

  // ─── empty-string env var is treated as unset ──────────────────────────────

  it('treats an empty-string env var as unset', () => {
    const result = applyEnvDefaults({}, { XRMFORGE_CLIENT_SECRET: '' });
    expect(result['clientSecret']).toBeUndefined();
  });

  // ─── only the mapped keys are touched ──────────────────────────────────────

  it('ignores unrelated environment variables and leaves other options intact', () => {
    const result = applyEnvDefaults({ entities: 'account' }, { PATH: '/usr/bin', HOME: '/home/x' });
    expect(result['entities']).toBe('account');
    expect(result['url']).toBeUndefined();
    expect(result['token']).toBeUndefined();
  });

  // ─── does not mutate the input ─────────────────────────────────────────────

  it('does not mutate the input object', () => {
    const cliOpts: Record<string, unknown> = {};
    applyEnvDefaults(cliOpts, FULL_ENV);
    expect(cliOpts).toEqual({});
  });

  // ─── full precedence chain: CLI flag > env var > config file ───────────────

  it('realizes precedence CLI flag > env var > config file when combined with mergeWithCliOptions', () => {
    // tenantId only in config, clientId only in env, clientSecret as a CLI flag.
    const config = { tenantId: 'config-tid', clientId: 'config-cid', clientSecret: 'config-secret' };
    const cliOpts = { clientSecret: 'flag-secret' };
    const env = { XRMFORGE_CLIENT_ID: 'env-cid' };

    const merged = mergeWithCliOptions(config, applyEnvDefaults(cliOpts, env));

    expect(merged['clientSecret']).toBe('flag-secret'); // CLI flag wins
    expect(merged['clientId']).toBe('env-cid');         // env beats config
    expect(merged['tenantId']).toBe('config-tid');      // config fills the gap
  });
});
