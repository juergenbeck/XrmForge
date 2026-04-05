import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanupTempDir } from '../helpers/temp-dir.js';
import { writeGeneratedFile, writeAllFiles, addGeneratedHeader, generateBarrelIndex } from '../../src/orchestrator/file-writer.js';
import type { GeneratedFile } from '../../src/orchestrator/types.js';

let tmpDir: string;

beforeEach(async () => { tmpDir = await createTempDir(); });
afterEach(async () => { await cleanupTempDir(tmpDir); });

describe('file-writer integration (real filesystem)', () => {
  it('should create nested directory structure and write file', async () => {
    const file: GeneratedFile = {
      relativePath: 'entities/account.ts',
      content: 'declare namespace Test { interface Account {} }',
      type: 'entity',
    };

    const written = await writeGeneratedFile(tmpDir, file);
    expect(written).toBe(true);

    const content = await readFile(join(tmpDir, 'entities', 'account.ts'), 'utf-8');
    expect(content).toBe(file.content);
  });

  it('should skip writing when content is unchanged', async () => {
    const file: GeneratedFile = {
      relativePath: 'entities/account.ts',
      content: 'declare namespace Test { interface Account {} }',
      type: 'entity',
    };

    const first = await writeGeneratedFile(tmpDir, file);
    expect(first).toBe(true);

    const second = await writeGeneratedFile(tmpDir, file);
    expect(second).toBe(false); // No change
  });

  it('should overwrite when content changed', async () => {
    const file1: GeneratedFile = {
      relativePath: 'entities/account.ts',
      content: 'version 1',
      type: 'entity',
    };
    const file2: GeneratedFile = {
      relativePath: 'entities/account.ts',
      content: 'version 2',
      type: 'entity',
    };

    await writeGeneratedFile(tmpDir, file1);
    const written = await writeGeneratedFile(tmpDir, file2);
    expect(written).toBe(true);

    const content = await readFile(join(tmpDir, 'entities', 'account.ts'), 'utf-8');
    expect(content).toBe('version 2');
  });

  it('should preserve UTF-8 with German umlauts', async () => {
    const file: GeneratedFile = {
      relativePath: 'entities/account.ts',
      content: '/** Account | Firma */\n/** Straße Nr. | Ort */\n/** Bevorzügter Kunde */\n',
      type: 'entity',
    };

    await writeGeneratedFile(tmpDir, file);
    const content = await readFile(join(tmpDir, 'entities', 'account.ts'), 'utf-8');
    expect(content).toContain('Firma');
    expect(content).toContain('Straße');
    expect(content).toContain('Bevorzügter');
  });

  it('should write multiple files via writeAllFiles', async () => {
    const files: GeneratedFile[] = [
      { relativePath: 'entities/account.ts', content: 'entity content', type: 'entity' },
      { relativePath: 'optionsets/account.ts', content: 'optionset content', type: 'optionset' },
      { relativePath: 'forms/account.ts', content: 'form content', type: 'form' },
    ];

    const result = await writeAllFiles(tmpDir, files);
    expect(result.written).toBe(3);
    expect(result.warnings).toHaveLength(0);

    const dirs = await readdir(tmpDir);
    expect(dirs).toContain('entities');
    expect(dirs).toContain('optionsets');
    expect(dirs).toContain('forms');
  });

  it('should handle empty file list gracefully', async () => {
    const result = await writeAllFiles(tmpDir, []);
    expect(result.written).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should generate barrel index referencing all file types', () => {
    const files: GeneratedFile[] = [
      { relativePath: 'entities/account.ts', content: '', type: 'entity' },
      { relativePath: 'optionsets/account.ts', content: '', type: 'optionset' },
      { relativePath: 'forms/account.ts', content: '', type: 'form' },
    ];

    const index = generateBarrelIndex(files);
    expect(index).toContain("export * from './entities/account.js';");
    expect(index).toContain("//   import { ... } from './optionsets/account.js';");
    expect(index).toContain("export * from './forms/account.js';");
  });
});
