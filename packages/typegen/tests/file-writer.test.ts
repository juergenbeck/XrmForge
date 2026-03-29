import { describe, it, expect } from 'vitest';
import { addGeneratedHeader, generateBarrelIndex } from '../src/orchestrator/file-writer.js';
import type { GeneratedFile } from '../src/orchestrator/types.js';

// ─── addGeneratedHeader ──────────────────────────────────────────────────────

describe('addGeneratedHeader', () => {
  it('should prepend the header to content', () => {
    const content = 'declare namespace XrmForge {}';
    const result = addGeneratedHeader(content);

    expect(result).toContain('@xrmforge/typegen');
    expect(result).toContain('Do not edit manually');
    expect(result).toContain(content);
    expect(result.indexOf('@xrmforge/typegen')).toBeLessThan(result.indexOf(content));
  });
});

// ─── generateBarrelIndex ─────────────────────────────────────────────────────

describe('generateBarrelIndex', () => {
  it('should generate triple-slash references for all files', () => {
    const files: GeneratedFile[] = [
      { relativePath: 'entities/account.d.ts', absolutePath: '', content: '', type: 'entity' },
      { relativePath: 'optionsets/account.d.ts', absolutePath: '', content: '', type: 'optionset' },
      { relativePath: 'forms/account.d.ts', absolutePath: '', content: '', type: 'form' },
    ];

    const result = generateBarrelIndex(files);

    expect(result).toContain('/// <reference path="entities/account.d.ts" />');
    expect(result).toContain('/// <reference path="optionsets/account.d.ts" />');
    expect(result).toContain('/// <reference path="forms/account.d.ts" />');
  });

  it('should group by type with headers', () => {
    const files: GeneratedFile[] = [
      { relativePath: 'entities/account.d.ts', absolutePath: '', content: '', type: 'entity' },
      { relativePath: 'entities/contact.d.ts', absolutePath: '', content: '', type: 'entity' },
      { relativePath: 'optionsets/account.d.ts', absolutePath: '', content: '', type: 'optionset' },
    ];

    const result = generateBarrelIndex(files);

    expect(result).toContain('// Entity Interfaces');
    expect(result).toContain('// OptionSet Enums');
  });

  it('should skip sections with no files', () => {
    const files: GeneratedFile[] = [
      { relativePath: 'entities/account.d.ts', absolutePath: '', content: '', type: 'entity' },
    ];

    const result = generateBarrelIndex(files);

    expect(result).toContain('// Entity Interfaces');
    expect(result).not.toContain('// OptionSet Enums');
    expect(result).not.toContain('// Form Interfaces');
  });

  it('should include generated header', () => {
    const files: GeneratedFile[] = [
      { relativePath: 'entities/account.d.ts', absolutePath: '', content: '', type: 'entity' },
    ];

    const result = generateBarrelIndex(files);

    expect(result).toContain('@xrmforge/typegen');
  });
});
