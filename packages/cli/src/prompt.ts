/**
 * @xrmforge/cli - Interactive credential prompt (OE-12 Stufe 2)
 *
 * When `xrmforge generate` runs in an interactive terminal (TTY) and required
 * connection/credential values are still missing after resolving CLI flags,
 * environment variables, a local `.env` and `xrmforge.config.json`, the user is
 * prompted for them. In a non-interactive context (CI) nothing is prompted - the
 * caller's validation then produces the usual clear error instead of hanging.
 *
 * Optionally the entered values are written to a local `./.env` (chmod 600 on
 * POSIX) for next time, so the secret never reaches the shell history or the
 * process list. The auth method itself is not persisted to `.env` (it is not a
 * secret; keep it in `xrmforge.config.json` or pass `--auth`).
 */
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { ENV_VAR_MAP } from './config.js';

/** Subset of resolved options relevant to the auth prompt. */
export interface PromptableAuth {
  url?: string;
  auth?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  token?: string;
}

/** Required option fields per auth method (besides `url`, which all methods need). */
const AUTH_FIELDS: Record<string, readonly string[]> = {
  'client-credentials': ['tenantId', 'clientId', 'clientSecret'],
  interactive: ['tenantId', 'clientId'],
  'device-code': ['tenantId', 'clientId'],
  token: ['token'],
};

const AUTH_METHODS = Object.keys(AUTH_FIELDS);

/** Human label per option key, used in the prompt text. */
const FIELD_LABEL: Record<string, string> = {
  url: 'Dataverse URL (e.g. https://myorg.crm4.dynamics.com)',
  tenantId: 'Azure AD tenant ID',
  clientId: 'Azure AD client (application) ID',
  clientSecret: 'Client secret',
  token: 'Bearer token',
};

/** Option keys treated as secret: their typed input is not echoed. */
const SECRET_FIELDS = new Set(['clientSecret', 'token']);

/**
 * Whether an interactive prompt is warranted: `url` missing, or the auth method
 * missing, or the chosen method is missing one of its required fields. Pure.
 *
 * An unknown auth method returns false here so that buildAuthConfig reports it
 * with its precise "Unknown auth method" error instead of prompting.
 */
export function needsInteractiveAuth(opts: PromptableAuth): boolean {
  if (!opts.url) return true;
  if (!opts.auth) return true;
  const fields = AUTH_FIELDS[opts.auth];
  if (!fields) return false;
  return fields.some((f) => !opts[f as keyof PromptableAuth]);
}

/** Build `export XRMFORGE_X=value` lines for the persistable (env-mapped) values. Pure. */
export function formatExportLines(optionValues: Record<string, string>): string[] {
  const lines: string[] = [];
  for (const [optKey, envVar] of ENV_VAR_MAP) {
    const v = optionValues[optKey];
    if (v !== undefined && v !== '') lines.push(`export ${envVar}=${v}`);
  }
  return lines;
}

/**
 * Merge the persistable entered values into existing `.env` content: replace a
 * `KEY=...` line when the key is already present, otherwise append it. Comments and
 * unrelated lines are preserved. Only keys in {@link ENV_VAR_MAP} are written
 * (so the auth method is never persisted). Pure.
 */
export function mergeEnvContent(existing: string, optionValues: Record<string, string>): string {
  const updates = new Map<string, string>();
  for (const [optKey, envVar] of ENV_VAR_MAP) {
    const v = optionValues[optKey];
    if (v !== undefined && v !== '') updates.set(envVar, v);
  }
  if (updates.size === 0) return existing;

  const lines = existing.length > 0 ? existing.split('\n') : [];
  const seen = new Set<string>();
  const out = lines.map((line) => {
    const key = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];
    if (key !== undefined) {
      const replacement = updates.get(key);
      if (replacement !== undefined) {
        seen.add(key);
        return `${key}=${replacement}`;
      }
    }
    return line;
  });
  for (const [envVar, value] of updates) {
    if (!seen.has(envVar)) out.push(`${envVar}=${value}`);
  }
  return out.join('\n');
}

/**
 * Write the persistable entered values to `<cwd>/.env`, merging with any existing
 * content, and tighten permissions to 0600 on POSIX (best effort; ignored on
 * Windows). Returns the absolute path written.
 */
export function writeEnvFile(cwd: string, optionValues: Record<string, string>): string {
  const path = join(cwd, '.env');
  const existing = existsSync(path) ? readFileSync(path, 'utf-8') : '';
  let content = mergeEnvContent(existing, optionValues);
  if (!content.endsWith('\n')) content += '\n';
  writeFileSync(path, content, { encoding: 'utf-8' });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* non-POSIX filesystem (e.g. Windows): permission bits not applicable */
  }
  return path;
}

/** A Writable that can suppress forwarding, used to hide secret input echo. */
class MuteWritable extends Writable {
  muted = false;
  constructor(private readonly inner: NodeJS.WritableStream) {
    super();
  }
  override _write(chunk: unknown, _enc: BufferEncoding, cb: (e?: Error | null) => void): void {
    if (!this.muted) this.inner.write(chunk as Buffer);
    cb();
  }
}

/** Injectable I/O for the prompt (defaults to stdin/stderr at the call site). */
export interface PromptIO {
  input: NodeJS.ReadableStream & { isTTY?: boolean };
  output: NodeJS.WritableStream;
}

/**
 * Prompt for the connection/auth values that are still missing.
 *
 * TTY-gating is the caller's responsibility (check `process.stdin.isTTY` before
 * calling). Returns the entered option values (to merge into the resolved options)
 * plus whether the user asked to persist them to `.env`.
 */
export async function promptForMissingAuth(
  opts: PromptableAuth,
  io: PromptIO,
): Promise<{ optionValues: Record<string, string>; persist: boolean }> {
  const muted = new MuteWritable(io.output);
  const rl = createInterface({
    input: io.input,
    output: muted,
    terminal: Boolean(io.input.isTTY),
  });
  const optionValues: Record<string, string> = {};

  try {
    io.output.write("\nMissing connection/credentials - let's set them up (Ctrl+C to abort).\n");

    if (!opts.url) {
      optionValues['url'] = (await rl.question(`${FIELD_LABEL['url']}: `)).trim();
    }

    let method = opts.auth;
    if (!method) {
      method = (await rl.question(`Auth method [${AUTH_METHODS.join(' / ')}]: `)).trim();
      optionValues['auth'] = method;
    }

    const fields = AUTH_FIELDS[method ?? ''];
    if (fields) {
      for (const field of fields) {
        if (opts[field as keyof PromptableAuth]) continue;
        const label = FIELD_LABEL[field] ?? field;
        optionValues[field] = SECRET_FIELDS.has(field)
          ? await questionHidden(rl, muted, io.output, `${label}: `)
          : (await rl.question(`${label}: `)).trim();
      }
    }

    let persist = false;
    const hasPersistable = ENV_VAR_MAP.some(
      ([optKey]) => optionValues[optKey] !== undefined && optionValues[optKey] !== '',
    );
    if (hasPersistable) {
      const answer = (await rl.question('\nSave these to ./.env for next time? [y/N]: '))
        .trim()
        .toLowerCase();
      persist = answer === 'y' || answer === 'yes';
    }

    return { optionValues, persist };
  } finally {
    rl.close();
  }
}

/**
 * Ask a question whose typed answer must not be echoed (secret). The query text is
 * written directly to the output, then character echo is muted while readline reads
 * the line.
 */
async function questionHidden(
  rl: ReturnType<typeof createInterface>,
  muted: MuteWritable,
  output: NodeJS.WritableStream,
  query: string,
): Promise<string> {
  output.write(query);
  muted.muted = true;
  try {
    const answer = await rl.question('');
    return answer.trim();
  } finally {
    muted.muted = false;
    output.write('\n');
  }
}
