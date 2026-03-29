/**
 * E2E Test: Complete Pipeline with tsc Verification
 *
 * This is the ultimate proof that XrmForge generates correct, compilable TypeScript.
 * It loads real Dataverse metadata, runs all generators, writes .d.ts files,
 * and verifies them with the TypeScript compiler.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createTempDir, cleanupTempDir } from '../helpers/temp-dir.js';
import { loadAccountEntityTypeInfo } from '../fixtures/load-fixture.js';
import { generateEntityInterface } from '../../src/generators/entity-generator.js';
import { generateEntityOptionSets } from '../../src/generators/optionset-generator.js';
import { generateEntityForms } from '../../src/generators/form-generator.js';
import { writeAllFiles, addGeneratedHeader, generateBarrelIndex } from '../../src/orchestrator/file-writer.js';
import type { GeneratedFile } from '../../src/orchestrator/types.js';
import type { LabelConfig } from '../../src/generators/label-utils.js';

const LABEL_CONFIG: LabelConfig = { primaryLanguage: 1033, secondaryLanguage: 1031 };

// Path to @types/xrm (pnpm hoists to typegen's node_modules)
const TYPES_XRM_PATH = join(__dirname, '..', '..', 'node_modules', '@types');

let tmpDir: string;

beforeEach(async () => { tmpDir = await createTempDir(); });
afterEach(async () => { await cleanupTempDir(tmpDir); });

describe('E2E: fixture to tsc-verified output', () => {
  it('should generate valid .d.ts files that pass tsc --noEmit', async () => {
    const entityInfo = loadAccountEntityTypeInfo();
    const files: GeneratedFile[] = [];

    // 1. Generate entity interface
    const entityContent = generateEntityInterface(entityInfo, {
      labelConfig: LABEL_CONFIG,
      namespace: 'XrmForge.Entities',
    });
    files.push({
      relativePath: 'entities/account.d.ts',
      content: addGeneratedHeader(entityContent),
      type: 'entity',
    });

    // 2. Generate OptionSet enums
    const picklistAttrs = entityInfo.picklistAttributes.map((p) => ({
      SchemaName: p.SchemaName,
      OptionSet: p.OptionSet ?? null,
      GlobalOptionSet: p.GlobalOptionSet ?? null,
    }));
    const optionSets = generateEntityOptionSets(picklistAttrs, 'account', {
      labelConfig: LABEL_CONFIG,
      namespace: 'XrmForge.OptionSets',
    });
    if (optionSets.length > 0) {
      files.push({
        relativePath: 'optionsets/account.d.ts',
        content: addGeneratedHeader(optionSets.map((os) => os.content).join('\n')),
        type: 'optionset',
      });
    }

    // 3. Generate form interfaces
    const formResults = generateEntityForms(entityInfo.forms, 'account', entityInfo.attributes, {
      labelConfig: LABEL_CONFIG,
      namespacePrefix: 'XrmForge.Forms',
    });
    if (formResults.length > 0) {
      files.push({
        relativePath: 'forms/account.d.ts',
        content: addGeneratedHeader(formResults.map((f) => f.content).join('\n')),
        type: 'form',
      });
    }

    // 4. Generate barrel index
    const indexContent = generateBarrelIndex(files);
    files.push({
      relativePath: 'index.d.ts',
      content: indexContent,
      type: 'entity',
    });

    // 5. Write all files to tmpDir
    const written = await writeAllFiles(tmpDir, files);
    expect(written).toBeGreaterThanOrEqual(3); // entity + optionset + form + index

    // 6. Write tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'bundler',
        lib: ['ES2020', 'DOM'],
        typeRoots: [TYPES_XRM_PATH],
        types: ['xrm'],
        strict: true,
        noEmit: true,
        skipLibCheck: false,
      },
      include: ['**/*.d.ts'],
    };
    await writeFile(join(tmpDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

    // 7. Run tsc --noEmit (use npx to find tsc correctly on all platforms)
    const projectPath = join(tmpDir, 'tsconfig.json').replace(/\\/g, '/');
    try {
      execSync(`npx tsc --noEmit --project "${projectPath}"`, {
        encoding: 'utf-8',
        timeout: 30000,
        cwd: join(__dirname, '..', '..'), // Run from typegen package root
      });
    } catch (error: any) {
      // If tsc fails, show the error output for debugging
      const stderr = error.stderr || '';
      const stdout = error.stdout || '';
      throw new Error(
        `tsc --noEmit failed!\n\nstdout:\n${stdout}\n\nstderr:\n${stderr}`,
      );
    }

    // If we get here, tsc succeeded. The generated types are valid TypeScript.
  }, 30000); // 30 second timeout for tsc

  it('should generate all expected file types', async () => {
    const entityInfo = loadAccountEntityTypeInfo();
    const files: GeneratedFile[] = [];

    files.push({
      relativePath: 'entities/account.d.ts',
      content: addGeneratedHeader(generateEntityInterface(entityInfo, { labelConfig: LABEL_CONFIG })),
      type: 'entity',
    });

    const picklistAttrs = entityInfo.picklistAttributes.map((p) => ({
      SchemaName: p.SchemaName, OptionSet: p.OptionSet ?? null, GlobalOptionSet: p.GlobalOptionSet ?? null,
    }));
    const optionSets = generateEntityOptionSets(picklistAttrs, 'account', { labelConfig: LABEL_CONFIG });
    if (optionSets.length > 0) {
      files.push({
        relativePath: 'optionsets/account.d.ts',
        content: addGeneratedHeader(optionSets.map((os) => os.content).join('\n')),
        type: 'optionset',
      });
    }

    const formResults = generateEntityForms(entityInfo.forms, 'account', entityInfo.attributes, { labelConfig: LABEL_CONFIG });
    if (formResults.length > 0) {
      files.push({
        relativePath: 'forms/account.d.ts',
        content: addGeneratedHeader(formResults.map((f) => f.content).join('\n')),
        type: 'form',
      });
    }

    await writeAllFiles(tmpDir, files);

    const dirs = await readdir(tmpDir);
    expect(dirs).toContain('entities');
    expect(dirs).toContain('optionsets');
    expect(dirs).toContain('forms');
  });

  it('should handle entity with no forms gracefully', () => {
    const entityInfo = loadAccountEntityTypeInfo();
    // Remove forms
    const noFormsInfo = { ...entityInfo, forms: [] };

    const formResults = generateEntityForms(noFormsInfo.forms, 'account', noFormsInfo.attributes);
    expect(formResults).toHaveLength(0);
  });

  it('should handle entity with no option sets gracefully', () => {
    const entityInfo = loadAccountEntityTypeInfo();

    const emptyOptionSets = generateEntityOptionSets([], 'account');
    expect(emptyOptionSets).toHaveLength(0);
  });
});
