/**
 * @xrmforge/devkit - Project Scaffolding
 *
 * Generates a complete D365 form scripting project from templates.
 */

import { mkdir, writeFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { ScaffoldConfig, ScaffoldResult } from './types.js';
import { BuildError, BuildErrorCode } from '../errors.js';

/**
 * Scaffold a new D365 form scripting project.
 *
 * Creates a complete project structure with package.json, tsconfig,
 * xrmforge.config.json, example form script, and test file.
 *
 * @param config - Scaffold configuration
 * @returns List of created files and any warnings
 * @throws {BuildError} if target directory is not empty (unless files are only dotfiles)
 */
export async function scaffoldProject(config: ScaffoldConfig): Promise<ScaffoldResult> {
  const { targetDir } = config;
  const filesCreated: string[] = [];
  const warnings: string[] = [];

  // Ensure target directory exists
  await mkdir(targetDir, { recursive: true });

  // Check if directory is empty (ignore dotfiles and node_modules)
  const existing = await readdir(targetDir);
  const nonDotFiles = existing.filter((f) => !f.startsWith('.') && f !== 'node_modules');
  if (nonDotFiles.length > 0 && !config.force) {
    throw new BuildError(
      BuildErrorCode.CONFIG_INVALID,
      `Target directory is not empty: ${targetDir}\n` +
        `Found: ${nonDotFiles.slice(0, 5).join(', ')}${nonDotFiles.length > 5 ? '...' : ''}\n` +
        `Use --force to scaffold anyway (existing files will be skipped).`,
      { targetDir, existingFiles: nonDotFiles },
    );
  }

  // Create directory structure
  const dirs = [
    'src/forms',
    'typings',
    'tests/forms',
  ];

  for (const dir of dirs) {
    await mkdir(join(targetDir, dir), { recursive: true });
  }

  // Generate and write all template files
  const templates = generateTemplates(config);

  for (const [relativePath, content] of templates) {
    const absolutePath = join(targetDir, relativePath);
    await mkdir(join(absolutePath, '..'), { recursive: true });

    // In force mode: skip files that already exist
    if (config.force) {
      try {
        await access(absolutePath);
        warnings.push(`Skipped ${relativePath} (already exists)`);
        continue;
      } catch {
        // File doesn't exist, proceed with write
      }
    }

    await writeFile(absolutePath, content, 'utf-8');
    filesCreated.push(relativePath);
  }

  return { filesCreated, warnings };
}

/**
 * Generate all template file contents.
 * Returns an array of [relativePath, content] tuples.
 */
function generateTemplates(config: ScaffoldConfig): Array<[string, string]> {
  const { projectName, prefix, namespace } = config;
  const lowerPrefix = prefix.toLowerCase();

  return [
    ['package.json', generatePackageJson(projectName)],
    ['tsconfig.json', generateTsConfig()],
    ['xrmforge.config.json', generateXrmForgeConfig(lowerPrefix, namespace)],
    ['vitest.config.ts', generateVitestConfig()],
    ['.gitignore', generateGitIgnore()],
    ['AGENT.md', generateAgentMd()],
    ['src/forms/example-form.ts', generateExampleForm(namespace)],
    ['typings/.gitkeep', ''],
    ['tests/forms/example-form.test.ts', generateExampleTest(namespace)],
    ['.github/workflows/ci.yml', generateGitHubActionsCI()],
    ['azure-pipelines.yml', generateAzureDevOpsPipeline()],
  ];
}

function generatePackageJson(projectName: string): string {
  const pkg = {
    name: projectName,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      generate: 'xrmforge generate',
      typecheck: 'tsc --noEmit',
      build: 'xrmforge build',
      watch: 'xrmforge build --watch',
      test: 'vitest run',
      'test:watch': 'vitest',
    },
    devDependencies: {
      '@types/xrm': '^9.0.90',
      '@xrmforge/cli': '^0.3.0',
      '@xrmforge/testing': '^0.1.0',
      '@xrmforge/formhelpers': '^0.1.0',
      typescript: '^5.7.0',
      vitest: '^3.0.0',
    },
  };
  return JSON.stringify(pkg, null, 2) + '\n';
}

function generateTsConfig(): string {
  const config = {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'bundler',
      lib: ['ES2020', 'DOM'],
      types: ['xrm'],
      strict: true,
      noEmit: true,
      skipLibCheck: false,
      esModuleInterop: true,
    },
    include: [
      'src/**/*.ts',
      'typings/**/*.d.ts',
      'typings/**/*.ts',
    ],
  };
  return JSON.stringify(config, null, 2) + '\n';
}

function generateXrmForgeConfig(prefix: string, namespace: string): string {
  const config = {
    build: {
      outDir: `./dist/${prefix}_/JS`,
      target: 'es2020',
      sourcemap: true,
      minify: true,
      entries: {
        example_form: {
          input: './src/forms/example-form.ts',
          namespace: `${namespace}.Example`,
          out: 'Example/OnLoad.js',
        },
      },
    },
  };
  return JSON.stringify(config, null, 2) + '\n';
}

function generateVitestConfig(): string {
  return `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    include: ['tests/**/*.test.ts'],
  },
});
`;
}

function generateGitIgnore(): string {
  return `# Dependencies
node_modules/

# Build output
dist/

# XrmForge cache
.xrmforge/

# IDE
.vscode/settings.json
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
`;
}

function generateAgentMd(): string {
  return `# XrmForge - AI Agent Instructions

This file helps AI coding assistants write optimal Dynamics 365 form scripts.

## Packages

- \`@xrmforge/typegen\` - Generates typed declarations from Dataverse metadata
- \`@xrmforge/testing\` - Type-safe form mocks: createFormMock(), fireOnChange()
- \`@xrmforge/formhelpers\` - typedForm() proxy for direct field access
- \`@xrmforge/devkit\` - esbuild IIFE bundles via xrmforge build
- \`@xrmforge/eslint-plugin\` - D365-specific ESLint rules

## Generated Types (typings/ directory)

Run \`xrmforge generate\` to create:
- \`typings/forms/{entity}.d.ts\` - Form interface + Fields/Tabs/Sections/Subgrids enums
- \`typings/optionsets/{entity}.d.ts\` - OptionSet const enums
- \`typings/entities/{entity}.d.ts\` - Entity interface + Fields enum
- \`typings/entity-names.d.ts\` - EntityNames const enum

## Rules: Always

1. **Fields Enum** for getAttribute/getControl (not raw strings):
   \`form.getAttribute(Fields.AccountName)\` not \`form.getAttribute("name")\`

2. **OptionSet Enum** for comparisons (not magic numbers):
   \`status === StatusCode.Active\` not \`status === 0\`

3. **Cast formContext** to generated form interface:
   \`const form = ctx.getFormContext() as AccountMainForm;\`

4. **EntityNames Enum** for Web API calls:
   \`Xrm.WebApi.retrieveRecord(EntityNames.Account, id)\`

5. **parseLookup()** from @xrmforge/typegen/helpers for lookup values
   IMPORTANT: Use \`@xrmforge/typegen/helpers\` (not \`@xrmforge/typegen\`) in browser code.
   The main entry point pulls in Node.js dependencies that break esbuild bundles.

6. **select()** from @xrmforge/typegen/helpers for $select queries

7. **createFormMock()** from @xrmforge/testing for tests

8. **Module exports** (not window/global assignments). esbuild globalName handles namespacing.

9. **Tabs/Sections/Subgrids Enums** for UI access

10. **Error handling** in all async event handlers (try/catch)

## Rules: Never

- Never \`getAttribute("raw_string")\` when Fields enum exists
- Never magic numbers for OptionSet values
- Never \`Xrm.Page\` (deprecated since D365 v9.0)
- Never synchronous XMLHttpRequest
- Never \`eval()\`
- Never \`window.X = ...\` (use module exports)

## Before/After Examples

### Field Access
\`\`\`typescript
// BEFORE: formContext.getAttribute("name").getValue()
// AFTER:
import { AccountMainFormFieldsEnum as Fields } from '../typings/forms/account';
const form = ctx.getFormContext() as AccountMainForm;
form.getAttribute(Fields.AccountName).getValue();  // StringAttribute, typed
\`\`\`

### OptionSet Comparison
\`\`\`typescript
// BEFORE: if (status.getValue() === 595300002) { ... }
// AFTER:
import { StatusCode } from '../typings/optionsets/invoice';
if (status.getValue() === StatusCode.Gebucht) { ... }
\`\`\`

### Testing
\`\`\`typescript
import { createFormMock } from '@xrmforge/testing';
const mock = createFormMock<AccountMainForm, AccountMainFormMockValues>({
  name: 'Test', statuscode: 0
});
onLoad(mock.executionContext);
expect(mock.formContext.getControl('revenue').getVisible()).toBe(true);
\`\`\`

## File Structure

\`\`\`
src/forms/{entity}-form.ts       - Form scripts (one per entity)
src/shared/{name}.ts             - Shared utilities
typings/                         - Generated types (do not edit manually)
tests/forms/{entity}.test.ts     - Tests
xrmforge.config.json             - Build config
\`\`\`

## Build

\`\`\`bash
npx xrmforge build               # IIFE bundles for D365
npx xrmforge build --watch        # Watch mode (~10ms rebuilds)
\`\`\`

## Full Migration Guide

See: https://www.npmjs.com/package/@xrmforge/typegen (MIGRATION.md)
`;
}

function generateExampleForm(namespace: string): string {
  return `/**
 * Example Form Script for Dynamics 365.
 *
 * Register in D365 as: ${namespace}.Example.onLoad
 *
 * Replace this with your actual form logic.
 */

/**
 * Called when the form loads.
 */
export function onLoad(executionContext: Xrm.Events.EventContext): void {
  const formContext = executionContext.getFormContext();

  // Example: show a notification on the form
  formContext.ui.setFormNotification(
    'Form loaded successfully',
    'INFO',
    'example-notification',
  );

  // Example: read a field value
  const nameAttr = formContext.getAttribute('name');
  if (nameAttr) {
    const value = nameAttr.getValue();
    console.log('Name field value:', value);
  }
}

/**
 * Called when the form is saved.
 */
export function onSave(executionContext: Xrm.Events.EventContext): void {
  const formContext = executionContext.getFormContext();

  // Clear the notification on save
  formContext.ui.clearFormNotification('example-notification');
}
`;
}

function generateExampleTest(namespace: string): string {
  return `import { describe, it, expect } from 'vitest';

/**
 * Example test for the form script.
 *
 * Uses @xrmforge/testing for type-safe mocking once you have
 * generated types. For now, this is a placeholder.
 */
describe('${namespace}.Example', () => {
  it('should export onLoad function', async () => {
    const mod = await import('../../src/forms/example-form.js');
    expect(typeof mod.onLoad).toBe('function');
  });

  it('should export onSave function', async () => {
    const mod = await import('../../src/forms/example-form.js');
    expect(typeof mod.onSave).toBe('function');
  });
});
`;
}

function generateGitHubActionsCI(): string {
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Generate types from Dataverse
        run: npx xrmforge generate --from-config
        env:
          XRMFORGE_CLIENT_ID: \${{ secrets.XRMFORGE_CLIENT_ID }}
          XRMFORGE_CLIENT_SECRET: \${{ secrets.XRMFORGE_CLIENT_SECRET }}
          XRMFORGE_TENANT_ID: \${{ secrets.XRMFORGE_TENANT_ID }}

      - name: Type check
        run: npx tsc --noEmit

      - name: Test
        run: npx vitest run

      - name: Build WebResources
        run: npx xrmforge build
`;
}

function generateAzureDevOpsPipeline(): string {
  return `trigger:
  branches:
    include:
      - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
    displayName: 'Install Node.js'

  - script: npm ci
    displayName: 'Install dependencies'

  - script: npx xrmforge generate --from-config
    displayName: 'Generate types from Dataverse'
    env:
      XRMFORGE_CLIENT_ID: \$(XRMFORGE_CLIENT_ID)
      XRMFORGE_CLIENT_SECRET: \$(XRMFORGE_CLIENT_SECRET)
      XRMFORGE_TENANT_ID: \$(XRMFORGE_TENANT_ID)

  - script: npx tsc --noEmit
    displayName: 'Type check'

  - script: npx vitest run
    displayName: 'Test'

  - script: npx xrmforge build
    displayName: 'Build WebResources'
`;
}
