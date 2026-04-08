/**
 * @xrmforge/devkit - Project Scaffolding
 *
 * Generates a complete D365 form scripting project from templates.
 */

import { mkdir, writeFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { ScaffoldConfig, ScaffoldResult } from './types.js';
import { BuildError, BuildErrorCode } from '../errors.js';
import { loadTemplate } from './template-loader.js';

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
    'src/shared',
    'typings',
    'tests/forms',
  ];

  for (const dir of dirs) {
    await mkdir(join(targetDir, dir), { recursive: true });
  }

  // Generate and write all template files
  const templates = await generateTemplates(config);

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
 * Generate all template file contents for a scaffolded project.
 *
 * @param config - Scaffold configuration with project name, prefix, and namespace
 * @returns Array of [relativePath, content] tuples for each file to create
 */
async function generateTemplates(config: ScaffoldConfig): Promise<Array<[string, string]>> {
  const { projectName, prefix, namespace } = config;
  const lowerPrefix = prefix.toLowerCase();
  const namespaceVars = { namespace };

  return [
    ['package.json', generatePackageJson(projectName)],
    ['tsconfig.json', generateTsConfig()],
    ['xrmforge.config.json', generateXrmForgeConfig(lowerPrefix, namespace)],
    ['vitest.config.ts', await loadTemplate('vitest.config.ts')],
    ['.gitignore', await loadTemplate('gitignore')],
    ['AGENT.md', await loadTemplate('AGENT.md')],
    ['src/forms/example-form.ts', await loadTemplate('example-form.ts', namespaceVars)],
    ['typings/.gitkeep', ''],
    ['tests/forms/example-form.test.ts', await loadTemplate('example-form.test.ts', namespaceVars)],
    ['src/shared/logger.ts', await loadTemplate('logger.ts', namespaceVars)],
    ['src/shared/error-handler.ts', await loadTemplate('error-handler.ts')],
    ['src/shared/constants.ts', await loadTemplate('constants.ts', namespaceVars)],
    ['eslint.config.js', await loadTemplate('eslint.config.js')],
    ['.github/workflows/ci.yml', await loadTemplate('github-actions-ci.yml')],
    ['azure-pipelines.yml', await loadTemplate('azure-pipelines.yml')],
    ['scripts/self-check.sh', await loadTemplate('self-check.sh')],
    ['scripts/validate-form.mjs', await loadTemplate('validate-form.mjs')],
  ];
}

/**
 * Generate package.json content for a scaffolded project.
 *
 * @param projectName - The project name for the name field
 * @returns Formatted JSON string
 */
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
      validate: 'node scripts/validate-form.mjs',
    },
    devDependencies: {
      '@types/xrm': '^9.0.90',
      '@typescript-eslint/eslint-plugin': '^8.0.0',
      '@typescript-eslint/parser': '^8.0.0',
      '@xrmforge/cli': '^0.4.9',
      '@xrmforge/eslint-plugin': '^0.2.1',
      '@xrmforge/helpers': '^0.2.0',
      '@xrmforge/testing': '^0.2.3',
      eslint: '^9.0.0',
      typescript: '^5.7.0',
      vitest: '^3.0.0',
    },
  };
  return JSON.stringify(pkg, null, 2) + '\n';
}

/**
 * Generate tsconfig.json content for a scaffolded project.
 *
 * @returns Formatted JSON string with D365-appropriate compiler options
 */
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

/**
 * Generate xrmforge.config.json content for a scaffolded project.
 *
 * @param prefix - Publisher prefix for WebResource paths (lowercase)
 * @param namespace - Base namespace for form script globals
 * @returns Formatted JSON string with a sample build entry
 */
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
