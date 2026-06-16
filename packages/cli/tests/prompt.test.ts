import { describe, it, expect } from 'vitest';
import { PassThrough, Writable } from 'node:stream';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  needsInteractiveAuth,
  formatExportLines,
  mergeEnvContent,
  writeEnvFile,
  promptForMissingAuth,
} from '../src/prompt.js';

describe('needsInteractiveAuth', () => {
  it('is false when url + method + required creds are all present', () => {
    expect(
      needsInteractiveAuth({ url: 'u', auth: 'client-credentials', tenantId: 't', clientId: 'c', clientSecret: 's' }),
    ).toBe(false);
  });

  it('is true when url is missing', () => {
    expect(needsInteractiveAuth({ auth: 'interactive', tenantId: 't', clientId: 'c' })).toBe(true);
  });

  it('is true when the auth method is missing', () => {
    expect(needsInteractiveAuth({ url: 'u' })).toBe(true);
  });

  it('is true when a client-credentials secret is missing', () => {
    expect(needsInteractiveAuth({ url: 'u', auth: 'client-credentials', tenantId: 't', clientId: 'c' })).toBe(true);
  });

  it('is false for interactive auth with tenant + client present', () => {
    expect(needsInteractiveAuth({ url: 'u', auth: 'interactive', tenantId: 't', clientId: 'c' })).toBe(false);
  });

  it('is true when token auth has no token, false when it does', () => {
    expect(needsInteractiveAuth({ url: 'u', auth: 'token' })).toBe(true);
    expect(needsInteractiveAuth({ url: 'u', auth: 'token', token: 'tok' })).toBe(false);
  });

  it('is false for an unknown method (buildAuthConfig reports it instead)', () => {
    expect(needsInteractiveAuth({ url: 'u', auth: 'magic' })).toBe(false);
  });
});

describe('formatExportLines', () => {
  it('emits export lines for env-mapped values and skips the auth method', () => {
    const lines = formatExportLines({ url: 'https://x', tenantId: 't', auth: 'client-credentials' });
    expect(lines).toContain('export XRMFORGE_URL=https://x');
    expect(lines).toContain('export XRMFORGE_TENANT_ID=t');
    expect(lines.join('\n')).not.toContain('auth');
  });

  it('skips empty values', () => {
    expect(formatExportLines({ url: '', token: 'tok' })).toEqual(['export XRMFORGE_TOKEN=tok']);
  });
});

describe('mergeEnvContent', () => {
  it('appends keys to empty content', () => {
    const out = mergeEnvContent('', { url: 'https://x', clientSecret: 's' });
    expect(out).toContain('XRMFORGE_URL=https://x');
    expect(out).toContain('XRMFORGE_CLIENT_SECRET=s');
  });

  it('replaces an existing key in place and preserves comments and other lines', () => {
    const existing = '# my env\nXRMFORGE_URL=old\nOTHER=keep';
    const out = mergeEnvContent(existing, { url: 'new' });
    expect(out).toContain('# my env');
    expect(out).toContain('OTHER=keep');
    expect(out).toContain('XRMFORGE_URL=new');
    expect(out).not.toContain('XRMFORGE_URL=old');
  });

  it('never writes the auth method (not env-mapped)', () => {
    const out = mergeEnvContent('', { auth: 'client-credentials', clientId: 'c' });
    expect(out).toContain('XRMFORGE_CLIENT_ID=c');
    expect(out).not.toContain('client-credentials');
  });
});

describe('writeEnvFile', () => {
  it('writes the values to <cwd>/.env and reads back', () => {
    const dir = mkdtempSync(join(tmpdir(), 'xrmforge-env-'));
    const path = writeEnvFile(dir, { url: 'https://x', clientSecret: 'sek' });
    expect(path).toBe(join(dir, '.env'));
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('XRMFORGE_URL=https://x');
    expect(content).toContain('XRMFORGE_CLIENT_SECRET=sek');
    expect(content.endsWith('\n')).toBe(true);
  });
});

/**
 * Build a mock PromptIO that responds to each prompt with the next scripted answer.
 * A finite batched stream would close before all questions are read ("readline was
 * closed"); instead we feed one line whenever the program writes a prompt (our
 * prompts all end with ': '), simulating a user typing in response.
 */
function mockIO(answers: string[]): { io: { input: PassThrough; output: Writable }; captured: () => string } {
  const input = new PassThrough();
  const chunks: string[] = [];
  let i = 0;
  const output = new Writable({
    write(chunk, _enc, cb) {
      const s = chunk.toString();
      chunks.push(s);
      if (s.endsWith(': ') && i < answers.length) {
        const answer = answers[i] ?? '';
        i++;
        setImmediate(() => input.write(answer + '\n'));
      }
      cb();
    },
  });
  return { io: { input, output }, captured: () => chunks.join('') };
}

describe('promptForMissingAuth', () => {
  it('collects url + client-credentials fields and persist=yes', async () => {
    // opts has the method already; url + tenant + client + secret are prompted.
    const { io } = mockIO(['https://env.crm4.dynamics.com', 'tid', 'cid', 'sek', 'y']);
    const { optionValues, persist } = await promptForMissingAuth({ auth: 'client-credentials' }, io);
    expect(optionValues).toEqual({
      url: 'https://env.crm4.dynamics.com',
      tenantId: 'tid',
      clientId: 'cid',
      clientSecret: 'sek',
    });
    expect(persist).toBe(true);
  });

  it('prompts for the auth method when missing and honours persist=no', async () => {
    // url present; method asked first, then interactive needs tenant + client; decline save.
    const { io } = mockIO(['interactive', 'tid', 'cid', 'n']);
    const { optionValues, persist } = await promptForMissingAuth({ url: 'https://x' }, io);
    expect(optionValues.auth).toBe('interactive');
    expect(optionValues.tenantId).toBe('tid');
    expect(optionValues.clientId).toBe('cid');
    expect(persist).toBe(false);
  });
});
