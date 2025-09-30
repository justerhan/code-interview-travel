import { defineConfig } from 'vitest/config';
import path from 'path';

// Vitest/Vite config to mirror the TS path alias `@/*` -> `./*`
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
  },
});
