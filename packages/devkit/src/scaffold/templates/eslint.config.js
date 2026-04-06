import xrmforge from '@xrmforge/eslint-plugin';

export default [
  xrmforge.configs.recommended,
  { rules: { 'no-console': ['error'] } },
  { files: ['src/shared/logger.ts'], rules: { 'no-console': 'off' } },
];
