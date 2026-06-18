import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { scaffoldProject } from '../src/scaffold/scaffold.js';
import { loadTemplate } from '../src/scaffold/template-loader.js';
import { BuildError } from '../src/errors.js';

let tmpDirs: string[] = [];

async function createTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'xrmforge-scaffold-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tmpDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

describe('scaffoldProject', () => {
  it('should create all expected files', async () => {
    const dir = await createTmpDir();

    const result = await scaffoldProject({
      targetDir: dir,
      projectName: 'my-d365-project',
      prefix: 'contoso',
      namespace: 'Contoso',
    });

    expect(result.filesCreated).toContain('package.json');
    expect(result.filesCreated).toContain('tsconfig.json');
    expect(result.filesCreated).toContain('xrmforge.config.json');
    expect(result.filesCreated).toContain('vitest.config.ts');
    expect(result.filesCreated).toContain('.gitignore');
    expect(result.filesCreated).toContain('.gitattributes');
    expect(result.filesCreated).toContain('src/forms/example-form.ts');
    expect(result.filesCreated).toContain('generated/.gitkeep');
    expect(result.filesCreated).toContain('tests/forms/example-form.test.ts');
    expect(result.filesCreated).toContain('AGENT.md');
    expect(result.filesCreated).toContain('.github/workflows/ci.yml');
    expect(result.filesCreated).toContain('azure-pipelines.yml');
    expect(result.filesCreated).toContain('scripts/validate-form.mjs');
    expect(result.filesCreated).toHaveLength(17);
  });

  it('should use project name in package.json', async () => {
    const dir = await createTmpDir();

    await scaffoldProject({
      targetDir: dir,
      projectName: 'markant-webresources',
      prefix: 'markant',
      namespace: 'Markant',
    });

    const pkg = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('markant-webresources');
  });

  it('should use prefix in xrmforge.config.json outDir', async () => {
    const dir = await createTmpDir();

    await scaffoldProject({
      targetDir: dir,
      projectName: 'test',
      prefix: 'contoso',
      namespace: 'Contoso',
    });

    const config = JSON.parse(await fs.readFile(path.join(dir, 'xrmforge.config.json'), 'utf-8'));
    expect(config.build.outDir).toBe('./dist/contoso_/JS');
  });

  it('should use namespace in example form script', async () => {
    const dir = await createTmpDir();

    await scaffoldProject({
      targetDir: dir,
      projectName: 'test',
      prefix: 'contoso',
      namespace: 'Contoso',
    });

    const form = await fs.readFile(path.join(dir, 'src/forms/example-form.ts'), 'utf-8');
    expect(form).toContain('Contoso.Example.onLoad');
  });

  it('should use namespace in xrmforge.config.json entry', async () => {
    const dir = await createTmpDir();

    await scaffoldProject({
      targetDir: dir,
      projectName: 'test',
      prefix: 'myprefix',
      namespace: 'MyPrefix',
    });

    const config = JSON.parse(await fs.readFile(path.join(dir, 'xrmforge.config.json'), 'utf-8'));
    expect(config.build.entries.example_form.namespace).toBe('MyPrefix.Example');
  });

  it('should use namespace in test file', async () => {
    const dir = await createTmpDir();

    await scaffoldProject({
      targetDir: dir,
      projectName: 'test',
      prefix: 'contoso',
      namespace: 'Contoso',
    });

    const test = await fs.readFile(path.join(dir, 'tests/forms/example-form.test.ts'), 'utf-8');
    expect(test).toContain('Contoso.Example');
  });

  it('should generate valid tsconfig.json with @types/xrm', async () => {
    const dir = await createTmpDir();

    await scaffoldProject({
      targetDir: dir,
      projectName: 'test',
      prefix: 'contoso',
      namespace: 'Contoso',
    });

    const tsconfig = JSON.parse(await fs.readFile(path.join(dir, 'tsconfig.json'), 'utf-8'));
    expect(tsconfig.compilerOptions.types).toContain('xrm');
    expect(tsconfig.compilerOptions.target).toBe('ES2020');
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it('should generate AGENT.md with XrmForge rules', async () => {
    const dir = await createTmpDir();

    await scaffoldProject({
      targetDir: dir,
      projectName: 'test',
      prefix: 'contoso',
      namespace: 'Contoso',
    });

    const agent = await fs.readFile(path.join(dir, 'AGENT.md'), 'utf-8');
    expect(agent).toContain('Fields Enum');
    expect(agent).toContain('OptionSet Enum');
    expect(agent).toContain('createFormMock');
    expect(agent).toContain('Never');
    expect(agent).toContain('xrmforge build');
    expect(agent).toContain('Pattern Recognition');
    expect(agent).toContain('setupXrmMock');
    expect(agent).toContain('@types/xrm Pitfalls');
    expect(agent).toContain('parseLookup');
    expect(agent).toContain('@xrmforge/helpers');
    // Lookup convention (F-LMA7-05): Fields vs NavigationProperties distinction must ship
    expect(agent).toContain('NavigationProperties');
  });

  it('should generate GitHub Actions CI workflow', async () => {
    const dir = await createTmpDir();

    await scaffoldProject({
      targetDir: dir,
      projectName: 'test',
      prefix: 'contoso',
      namespace: 'Contoso',
    });

    const ci = await fs.readFile(path.join(dir, '.github/workflows/ci.yml'), 'utf-8');
    expect(ci).toContain('xrmforge generate');
    expect(ci).toContain('xrmforge build');
    expect(ci).toContain('vitest run');
    expect(ci).toContain('npm run validate');
    expect(ci).toContain('XRMFORGE_CLIENT_ID');
    // Credentials come from the XRMFORGE_* env block, never as a CLI flag (no secret
    // in the runner's process list). See OE-12 Stufe 1.
    expect(ci).not.toContain('--client-secret');
  });

  it('should generate Azure DevOps pipeline', async () => {
    const dir = await createTmpDir();

    await scaffoldProject({
      targetDir: dir,
      projectName: 'test',
      prefix: 'contoso',
      namespace: 'Contoso',
    });

    const pipeline = await fs.readFile(path.join(dir, 'azure-pipelines.yml'), 'utf-8');
    expect(pipeline).toContain('xrmforge generate');
    expect(pipeline).toContain('xrmforge build');
    expect(pipeline).toContain('ubuntu-latest');
    expect(pipeline).toContain('XRMFORGE_TENANT_ID');
    // Credentials come from the XRMFORGE_* env block, never as a CLI flag. OE-12 Stufe 1.
    expect(pipeline).not.toContain('--client-secret');
  });

  it('should throw when directory is not empty', async () => {
    const dir = await createTmpDir();
    await fs.writeFile(path.join(dir, 'existing-file.txt'), 'content');

    await expect(scaffoldProject({
      targetDir: dir,
      projectName: 'test',
      prefix: 'contoso',
      namespace: 'Contoso',
    })).rejects.toThrow(BuildError);
  });

  it('should allow directory with only dotfiles', async () => {
    const dir = await createTmpDir();
    await fs.writeFile(path.join(dir, '.git'), 'gitdir');

    const result = await scaffoldProject({
      targetDir: dir,
      projectName: 'test',
      prefix: 'contoso',
      namespace: 'Contoso',
    });

    expect(result.filesCreated.length).toBeGreaterThan(0);
  });

  it('should create target directory if it does not exist', async () => {
    const dir = path.join(await createTmpDir(), 'nested', 'project');

    const result = await scaffoldProject({
      targetDir: dir,
      projectName: 'test',
      prefix: 'contoso',
      namespace: 'Contoso',
    });

    expect(result.filesCreated.length).toBe(17);
    const exists = await fs.access(path.join(dir, 'package.json')).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('should include @xrmforge packages in devDependencies', async () => {
    const dir = await createTmpDir();

    await scaffoldProject({
      targetDir: dir,
      projectName: 'test',
      prefix: 'contoso',
      namespace: 'Contoso',
    });

    const pkg = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf-8'));
    expect(pkg.devDependencies['@xrmforge/cli']).toBeDefined();
    expect(pkg.devDependencies['@xrmforge/testing']).toBeDefined();
    expect(pkg.devDependencies['@types/xrm']).toBeDefined();
  });
});

describe('loadTemplate', () => {
  it('should load a template without variables', async () => {
    const content = await loadTemplate('gitignore');
    expect(content).toContain('node_modules/');
    expect(content).toContain('dist/');
    // `.env` must be ignored: the generate prompt can write secrets there (OE-12 Stufe 2).
    expect(content).toContain('.env');
  });

  it('should substitute variables in templates', async () => {
    const content = await loadTemplate('example-form.ts', { namespace: 'TestNS' });
    expect(content).toContain('TestNS.Example.onLoad');
    expect(content).not.toContain('{{namespace}}');
  });

  it('should return template unchanged when no vars provided', async () => {
    const content = await loadTemplate('AGENT.md');
    expect(content).toContain('XrmForge');
    expect(content).not.toContain('{{');
  });

  it('should throw for non-existent template', async () => {
    await expect(loadTemplate('does-not-exist.txt')).rejects.toThrow();
  });
});
