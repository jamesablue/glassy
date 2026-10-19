import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Each test synthesises a full stack, which takes a moment.
    testTimeout: 30_000,
  },
});
