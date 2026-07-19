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
    'generated',
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
    ['tsconfig.tests.json', generateTestsTsConfig()],
    ['xrmforge.config.json', generateXrmForgeConfig(lowerPrefix, namespace)],
    ['vitest.config.ts', await loadTemplate('vitest.config.ts')],
    ['.gitignore', await loadTemplate('gitignore')],
    ['.gitattributes', generateGitAttributes()],
    ['AGENT.md', await loadTemplate('AGENT.md')],
    ['src/forms/example-form.ts', await loadTemplate('example-form.ts', namespaceVars)],
    ['generated/.gitkeep', ''],
    ['tests/forms/example-form.test.ts', await loadTemplate('example-form.test.ts', namespaceVars)],
    ['src/shared/logger.ts', await loadTemplate('logger.ts', namespaceVars)],
    ['src/shared/error-handler.ts', await loadTemplate('error-handler.ts')],
    ['src/shared/constants.ts', await loadTemplate('constants.ts', namespaceVars)],
    ['eslint.config.js', await loadTemplate('eslint.config.js')],
    ['.github/workflows/ci.yml', await loadTemplate('github-actions-ci.yml')],
    ['azure-pipelines.yml', await loadTemplate('azure-pipelines.yml')],
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
      // Two passes: the strict main config (src/ + generated/, skipLibCheck false) and the
      // tests config (tests/ with skipLibCheck true, so happy-dom/vitest .d.ts internals do not
      // fail while real type errors in the test code still surface). See tsconfig.tests.json.
      typecheck: 'tsc --noEmit && tsc --noEmit -p tsconfig.tests.json',
      build: 'xrmforge build',
      watch: 'xrmforge build --watch',
      test: 'vitest run',
      'test:watch': 'vitest',
      lint: 'eslint . --max-warnings=0',
      'validate:form': 'node scripts/validate-form.mjs',
    },
    devDependencies: {
      // @types/node: needed once tests/ is typechecked (tsconfig.tests.json). happy-dom and
      // vitest .d.ts reference NodeJS/Buffer/vm; skipLibCheck hides their internals, but test
      // code that touches Node globals still needs these types.
      '@types/node': '^20.0.0',
      '@types/xrm': '^9.0.90',
      '@typescript-eslint/eslint-plugin': '^8.0.0',
      '@typescript-eslint/parser': '^8.0.0',
      // 0.x caret ranges only allow the same minor: keep these pins on the
      // current minor of each package, otherwise scaffolded projects install
      // outdated versions (e.g. helpers ^0.3.0 never resolves to 0.6.x).
      // cli ^0.9.0: pin to the current cli minor so a fresh `init` pulls the newest cli and,
      // transitively, typegen 0.15.0 with the XxxExpands polymorphic $expand enum (F-MK9-08-Sub).
      // The env-var CI template (XRMFORGE_* without auth flags, since 0.7.0) plus the ./.env
      // auto-load and interactive prompt (0.8.0) also need cli at its current minor. A 0.x caret
      // never crosses a minor boundary, so an older pin would hand fresh projects an outdated cli
      // (F-MK11-01: ^0.8.0 resolved to 0.8.21 -> typegen 0.14.2, missing XxxExpands).
      // helpers ^0.14.0: clearAppNotification + parentXrm()/getWebResourceContext() (browser-safe HTML
      // WebResource context helpers) ship in 0.14.0 (Runde 10 FW-4/F-LMA10-03); expanded<T>()/expandedMany<T>()
      // typedField (single field by a variable/runtime name, avoids the F-LMA12-01 kindMap union trap; OE-17) since 0.16.0;
      // typedFields (cross-entity/multi-form kindMap) since 0.15.0 (OE-16); typed $expand readers since 0.13.0 (F-MK9-08); addAppNotification autoHideMs (self-clearing transient
      // banners) since 0.12.0 (Runde 9 F-MK9-10); on-form setAndSubmit, off-form formLookupIdUnsafe/
      // formLookupUnsafe, getEnvironmentVariable, isUnsavedRecord since 0.11.0 (Runde 8: F-LMA8-N1/N2,
      // F-MK8-N4a/b); MultiSelect/submit/app-notification (parseMultiSelect, clearAndSubmit, setUnsafeAndSubmit,
      // addAppNotification) since 0.10.0; void Custom API executors since 0.9.0; isFormType since 0.8.0.
      // testing ^0.8.0: FakeTransport (scriptable DataverseTransport for testing retrieveAll consumers,
      // OE-15 stage 1) since 0.8.0; Xrm.App notification tracking (setupXrmMock getGlobalNotifications + unique ids) and
      // MockControl.setContentWindow ship in 0.7.0 (Runde 10 FW-5/F-LMA10-06); subgrid MockControl.refresh()
      // since 0.6.0 (Runde 9: F-MK9-01); online.execute override + OptionSet/view/setFilterXml mock methods
      // since 0.5.0 (Runde 8: F-MK8-04b); complex-form mocks (createFormMock formType, getText/getPrecision,
      // addOnSave/fireOnSave, roles ItemCollection, utilityOverrides) since 0.4.0; tabs since 0.3.0.
      '@xrmforge/cli': '^0.10.0',
      '@xrmforge/eslint-plugin': '^0.3.0',
      '@xrmforge/helpers': '^0.16.0',
      '@xrmforge/testing': '^0.8.0',
      eslint: '^9.0.0',
      // happy-dom ^16: DOM test environment for HTML WebResource tests (Runde 10 F-LMA10-07). Pinned to 16
      // (the newest major that still supports Node 18, `node >=18`; 17+ require Node 20). Used per-test via
      // the `// @vitest-environment happy-dom` pragma so node-default form-script tests are not slowed down.
      'happy-dom': '^16.0.0',
      typescript: '^5.7.0',
      vitest: '^3.0.0',
    },
  };
  return JSON.stringify(pkg, null, 2) + '\n';
}

/**
 * Generate .gitattributes content for a scaffolded project.
 *
 * Pins generated declarations (and source/config) to LF. typegen writes LF,
 * but git with core.autocrlf=true (the Windows default) would otherwise check
 * the files out as CRLF, and `xrmforge generate --check` would report false
 * drift on every file. Forcing eol=lf keeps the drift gate green on Windows.
 *
 * @returns .gitattributes content
 */
function generateGitAttributes(): string {
  return [
    '# typegen writes LF. Pin generated files to LF so `xrmforge generate --check`',
    '# stays stable on Windows (git core.autocrlf would otherwise serve CRLF',
    '# working copies and the byte comparison would report false drift).',
    'generated/** text eol=lf',
    '',
    '# Keep source and config line endings consistent across platforms.',
    '*.ts   text eol=lf',
    '*.mjs  text eol=lf',
    '*.json text eol=lf',
    '',
  ].join('\n');
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
      'generated/**/*.ts',
    ],
  };
  return JSON.stringify(config, null, 2) + '\n';
}

/**
 * Generate tsconfig.tests.json content for a scaffolded project.
 *
 * A second, test-only typecheck pass. The main tsconfig deliberately keeps
 * `skipLibCheck: false` to strictly check the generated types, but that makes the
 * happy-dom/vitest `.d.ts` (which reference @types/node globals and collide with
 * lib.dom) fail once `tests/` is in scope. This config extends the main one, adds
 * `tests/` to the scope, turns on `skipLibCheck` (dependency `.d.ts` internals are
 * not ours to fix) and adds the node types. Real type errors in the test code
 * itself still surface. `pnpm typecheck` runs both passes.
 *
 * @returns Formatted JSON string
 */
function generateTestsTsConfig(): string {
  const config = {
    extends: './tsconfig.json',
    compilerOptions: {
      skipLibCheck: true,
      types: ['xrm', 'node'],
    },
    include: [
      'src/**/*.ts',
      'generated/**/*.ts',
      'tests/**/*.ts',
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
