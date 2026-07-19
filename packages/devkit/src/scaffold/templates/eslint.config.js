import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import xrmforge from '@xrmforge/eslint-plugin';

export default [
  // `pnpm lint` runs `eslint .`; without these ignores it also lints the build output
  // (dist/, inlined constants -> raw-string errors), the gate script (scripts/, no-console),
  // and legacy-reference/ code kept as a migration reference (raw strings/console by design).
  { ignores: ['dist/**', 'scripts/**', 'legacy-reference/**'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // The D365 rules (raw-string bans, namespace, sync-webapi, ...) and no-console apply to
  // src/ ONLY. Restricting them by files keeps them off tests/, where literal strings in
  // assertions (field names, notification ids, messages) and console output are legitimate.
  // The validate-form gate also lints only src/, so `pnpm lint` on src/ stays in sync with it
  // (F12-03, F-MK13-01).
  { ...xrmforge.configs.recommended, files: ['src/**/*.ts'] },
  { files: ['src/**/*.ts'], rules: { 'no-console': ['error'] } },
  { files: ['src/shared/logger.ts'], rules: { 'no-console': 'off' } },
  // tests/ get a lean, non-type-aware ruleset: catch dead imports/vars, but NOT the D365
  // raw-string rules (test assertions use literal field names/values by design) and not
  // no-explicit-any (mocks occasionally need `any`). tests/ are typechecked separately via
  // tsconfig.tests.json; this block is the lint half of that coverage (OE-25).
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
