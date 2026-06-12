import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CLI_PATH = join(__dirname, '..', 'dist', 'index.js');
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync('node', [CLI_PATH, ...args], {
      encoding: 'utf-8',
      timeout: 10000,
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
