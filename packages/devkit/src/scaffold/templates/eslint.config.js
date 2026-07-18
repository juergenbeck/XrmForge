import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import xrmforge from '@xrmforge/eslint-plugin';

export default [
  // `pnpm lint` runs `eslint .`; without these ignores it also lints the build output
  // (dist/, inlined constants -> raw-string errors), the gate script (scripts/, no-console),
  // and legacy-reference/ code kept as a migration reference (raw strings/console by design).
  // The validate-form gate lints only src/, so this keeps `pnpm lint` in sync with it (F12-03, F-MK13-01).
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
  xrmforge.configs.recommended,
  { rules: { 'no-console': ['error'] } },
  { files: ['src/shared/logger.ts'], rules: { 'no-console': 'off' } },
];
