import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Runs the backend's specs and the shared contract's. shared/ has no package of its own: it is
 * plain TypeScript, tested here in Node and compiled into the app by the Angular build.
 */
export default defineConfig({
  resolve: {
    alias: { '@glassy/shared': fileURLToPath(new URL('../shared/index.ts', import.meta.url)) },
  },
  test: {
    dir: fileURLToPath(new URL('..', import.meta.url)),
    include: ['backend/src/**/*.spec.ts', 'shared/**/*.spec.ts'],
    globals: true,
  },
});
