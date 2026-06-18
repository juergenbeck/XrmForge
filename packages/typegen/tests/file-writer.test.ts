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
  it('should generate export-star re-exports for all files', () => {
    const files: GeneratedFile[] = [
      { relativePath: 'entities/account.ts', absolutePath: '', content: '', type: 'entity' },
      { relativePath: 'optionsets/account.ts', absolutePath: '', content: '', type: 'optionset' },
      { relativePath: 'forms/account.ts', absolutePath: '', content: '', type: 'form' },
    ];

    const result = generateBarrelIndex(files);

    expect(result).toContain("export * from './entities/account.js';");
    expect(result).toContain("//   import { ... } from './optionsets/account.js';");
    expect(result).toContain("export * from './forms/account.js';");
  });

  it('does not export-star actions; comments them instead (F-LMA7-01, avoids TS2308)', () => {
    const files: GeneratedFile[] = [
      { relativePath: 'entities/account.ts', absolutePath: '', content: '', type: 'entity' },
      { relativePath: 'actions/account.ts', absolutePath: '', content: '', type: 'action' },
      { relativePath: 'actions/contact.ts', absolutePath: '', content: '', type: 'action' },
    ];

    const result = generateBarrelIndex(files);

    // Same-named bound MS-standard actions across entity modules would collide
    // under a flat re-export (TS2308); the barrel must comment them, not export *.
    expect(result).not.toContain("export * from './actions/account.js';");
    expect(result).not.toContain("export * from './actions/contact.js';");
    expect(result).toContain('// Custom API Actions & Functions - import directly from individual files to avoid name conflicts:');
    expect(result).toContain("//   import { ... } from './actions/account.js';");
  });

  it('should group by type with headers', () => {
    const files: GeneratedFile[] = [
      { relativePath: 'entities/account.ts', absolutePath: '', content: '', type: 'entity' },
      { relativePath: 'entities/contact.ts', absolutePath: '', content: '', type: 'entity' },
      { relativePath: 'optionsets/account.ts', absolutePath: '', content: '', type: 'optionset' },
    ];

    const result = generateBarrelIndex(files);

    expect(result).toContain('// Entity Interfaces');
    expect(result).toContain('// OptionSet Enums - import directly from individual files to avoid name conflicts:');
  });

  it('should skip sections with no files', () => {
    const files: GeneratedFile[] = [
      { relativePath: 'entities/account.ts', absolutePath: '', content: '', type: 'entity' },
    ];

    const result = generateBarrelIndex(files);

    expect(result).toContain('// Entity Interfaces');
    expect(result).not.toContain('// OptionSet Enums');
    expect(result).not.toContain('// Form Interfaces');
  });

  it('should include generated header', () => {
    const files: GeneratedFile[] = [
      { relativePath: 'entities/account.ts', absolutePath: '', content: '', type: 'entity' },
    ];

    const result = generateBarrelIndex(files);

    expect(result).toContain('@xrmforge/typegen');
  });
});
