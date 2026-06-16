import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CLI_PATH = join(__dirname, '..', 'dist', 'index.js');
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

/** XRMFORGE_* env vars the CLI reads. Cleared per-run so a developer's shell
 *  cannot leak into the validation tests; opt in explicitly via `extraEnv`. */
const XRMFORGE_ENV_KEYS = [
  'XRMFORGE_URL',
  'XRMFORGE_TENANT_ID',
  'XRMFORGE_CLIENT_ID',
  'XRMFORGE_CLIENT_SECRET',
  'XRMFORGE_TOKEN',
];

function runCli(
  args: string[],
  extraEnv: Record<string, string> = {},
): { stdout: string; stderr: string; exitCode: number } {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of XRMFORGE_ENV_KEYS) delete env[key];
  Object.assign(env, extraEnv);

  try {
    // `input: ''` forces stdin to a non-TTY pipe so the interactive credential
    // prompt (OE-12 Stufe 2) never triggers here - the validation tests below rely
    // on the missing-field error firing instead of a prompt that would hang.
    const stdout = execFileSync('node', [CLI_PATH, ...args], {
      encoding: 'utf-8',
      timeout: 10000,
      env,
      input: '',
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.status ?? 1,
    };
  }
}

describe('xrmforge CLI', () => {
  it('should show help with --help', () => {
    const result = runCli(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('xrmforge');
    expect(result.stdout).toContain('generate');
  });

  it('should show version with --version', () => {
    const result = runCli(['--version']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(pkg.version);
  });

  it('should show generate help', () => {
    const result = runCli(['generate', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('--url');
    expect(result.stdout).toContain('--auth');
    expect(result.stdout).toContain('--entities');
    expect(result.stdout).toContain('--output');
    expect(result.stdout).toContain('--label-language');
    expect(result.stdout).toContain('--secondary-language');
    expect(result.stdout).toContain('--no-forms');
    expect(result.stdout).toContain('--no-optionsets');
    expect(result.stdout).toContain('--check');
    expect(result.stdout).toContain('Drift check');
  });
});

describe('xrmforge generate validation', () => {
  it('should require --entities or --solution', () => {
    const result = runCli([
      'generate',
      '--url', 'https://test.crm4.dynamics.com',
      '--auth', 'client-credentials',
      '--tenant-id', 'tid',
      '--client-id', 'cid',
      '--client-secret', 'secret',
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--entities or --solution');
  });

  it('should require --tenant-id for client-credentials', () => {
    const result = runCli([
      'generate',
      '--url', 'https://test.crm4.dynamics.com',
      '--auth', 'client-credentials',
      '--entities', 'account',
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--tenant-id');
  });

  it('should require --client-id for client-credentials', () => {
    const result = runCli([
      'generate',
      '--url', 'https://test.crm4.dynamics.com',
      '--auth', 'client-credentials',
      '--tenant-id', 'tid',
      '--entities', 'account',
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--client-id');
  });

  it('should require --client-secret for client-credentials', () => {
    const result = runCli([
      'generate',
      '--url', 'https://test.crm4.dynamics.com',
      '--auth', 'client-credentials',
      '--tenant-id', 'tid',
      '--client-id', 'cid',
      '--entities', 'account',
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--client-secret');
  });

  it('should reject unknown auth method', () => {
    const result = runCli([
      'generate',
      '--url', 'https://test.crm4.dynamics.com',
      '--auth', 'magic-auth',
      '--entities', 'account',
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown auth method');
  });

  it('should require --tenant-id for interactive auth', () => {
    const result = runCli([
      'generate',
      '--url', 'https://test.crm4.dynamics.com',
      '--auth', 'interactive',
      '--entities', 'account',
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--tenant-id');
  });

  it('should require --tenant-id for device-code auth', () => {
    const result = runCli([
      'generate',
      '--url', 'https://test.crm4.dynamics.com',
      '--auth', 'device-code',
      '--entities', 'account',
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--tenant-id');
  });
});

describe('xrmforge generate env-var fallbacks (OE-12 Stufe 1)', () => {
  it('reads the environment URL from XRMFORGE_URL (no --url flag)', () => {
    // No --url anywhere; it must come from the environment. The command then gets
    // past the "--url is required" check and fails later at the missing tenant-id,
    // which deterministically proves XRMFORGE_URL was read (no network needed).
    const result = runCli(
      ['generate', '--auth', 'client-credentials', '--entities', 'account'],
      { XRMFORGE_URL: 'https://env.crm4.dynamics.com' },
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).not.toContain('--url is required');
    expect(result.stderr).toContain('--tenant-id');
  });

  it('reads tenant-id and client-id from the environment (fails next at the missing secret)', () => {
    // tenant-id + client-id come from the environment; only the secret is missing.
    // The auth validation order is tenant -> client -> secret, so failing on the
    // secret proves both XRMFORGE_TENANT_ID and XRMFORGE_CLIENT_ID were read.
    const result = runCli(
      ['generate', '--url', 'https://test.crm4.dynamics.com', '--auth', 'client-credentials', '--entities', 'account'],
      { XRMFORGE_TENANT_ID: 'env-tid', XRMFORGE_CLIENT_ID: 'env-cid' },
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).not.toContain('--tenant-id');
    expect(result.stderr).not.toContain('--client-id is required');
    expect(result.stderr).toContain('--client-secret');
  });
});
