import { describe, it, expect } from 'vitest';
import { validateBuildConfig, resolveBuildConfig } from '../src/config.js';
import { BuildError, BuildErrorCode } from '../src/errors.js';

describe('validateBuildConfig', () => {
  it('should accept a valid minimal config', () => {
    const config = validateBuildConfig({
      entries: {
        my_script: { input: './src/my-script.ts', namespace: 'Contoso.MyScript' },
      },
    });
    expect(config.entries['my_script']!.input).toBe('./src/my-script.ts');
    expect(config.entries['my_script']!.namespace).toBe('Contoso.MyScript');
  });

  it('should accept a full config with all optional fields', () => {
    const config = validateBuildConfig({
      bundler: 'esbuild',
      entries: {
        account: { input: './src/account.ts', namespace: 'Contoso.Account', out: 'custom.js' },
      },
      outDir: './output',
      target: 'es2022',
      sourcemap: false,
      minify: true,
      external: ['lodash'],
    });
    expect(config.outDir).toBe('./output');
    expect(config.minify).toBe(true);
  });

  it('should throw on null/undefined', () => {
    expect(() => validateBuildConfig(null)).toThrow(BuildError);
    expect(() => validateBuildConfig(undefined)).toThrow(BuildError);
  });

  it('should throw when entries is missing', () => {
    expect(() => validateBuildConfig({})).toThrow(BuildError);
  });

  it('should throw when entries is empty', () => {
    expect(() => validateBuildConfig({ entries: {} })).toThrow(BuildError);
  });

  it('should throw when entries is an array', () => {
    expect(() => validateBuildConfig({ entries: [] })).toThrow(BuildError);
  });

  it('should throw when entry has no input', () => {
    const err = expect(() => validateBuildConfig({
      entries: { bad: { namespace: 'Contoso.Bad' } },
    })).toThrow(BuildError);
  });

  it('should throw when entry has no namespace', () => {
    expect(() => validateBuildConfig({
      entries: { bad: { input: './src/bad.ts' } },
    })).toThrow(BuildError);
  });

  it('should throw on unsupported bundler', () => {
    expect(() => validateBuildConfig({
      bundler: 'webpack',
      entries: { a: { input: './a.ts', namespace: 'A' } },
    })).toThrow(/Unsupported bundler/);
  });

  it('should include entry name in error context', () => {
    try {
      validateBuildConfig({
        entries: { problem_entry: { input: './x.ts' } },
      });
    } catch (e) {
      expect(e).toBeInstanceOf(BuildError);
      expect((e as BuildError).code).toBe(BuildErrorCode.CONFIG_INVALID);
      expect((e as BuildError).context['entry']).toBe('problem_entry');
    }
  });
});

describe('resolveBuildConfig', () => {
  it('should apply default values', () => {
    const resolved = resolveBuildConfig({
      entries: { a: { input: './a.ts', namespace: 'A' } },
    });
    expect(resolved.bundler).toBe('esbuild');
    expect(resolved.outDir).toBe('./dist');
    expect(resolved.target).toBe('es2020');
    expect(resolved.sourcemap).toBe(true);
    expect(resolved.minify).toBe(false);
    expect(resolved.external).toEqual([]);
  });

  it('should preserve explicit values', () => {
    const resolved = resolveBuildConfig({
      bundler: 'esbuild',
      entries: { a: { input: './a.ts', namespace: 'A' } },
      outDir: './out',
      target: 'es2022',
      sourcemap: false,
      minify: true,
      external: ['fs'],
    });
    expect(resolved.outDir).toBe('./out');
    expect(resolved.target).toBe('es2022');
    expect(resolved.sourcemap).toBe(false);
    expect(resolved.minify).toBe(true);
    expect(resolved.external).toEqual(['fs']);
  });
});
