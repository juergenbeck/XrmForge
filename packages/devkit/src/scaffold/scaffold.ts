/**
 * @xrmforge/devkit - Project Scaffolding
 *
 * Generates a complete D365 form scripting project from templates.
 */

import { mkdir, writeFile, readdir } from 'node:fs/promises';
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
  if (nonDotFiles.length > 0) {
    throw new BuildError(
      BuildErrorCode.CONFIG_INVALID,
      `Target directory is not empty: ${targetDir}\n` +
        `Found: ${nonDotFiles.slice(0, 5).join(', ')}${nonDotFiles.length > 5 ? '...' : ''}\n` +
        `Use an empty directory or remove existing files first.`,
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
