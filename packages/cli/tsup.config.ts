import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20',
  sourcemap: true,
  banner: {
    // Shebang for CLI executable
    js: '#!/usr/bin/env node',
  },
});
