import { defineConfig } from 'vitest/config';

/**
 * Vitest settings merged into the Angular unit-test builder (`runnerConfig` in angular.json).
 * The domain layer is pure logic with no framework code, so it carries a strict coverage floor of
 * its own; `npm run test:ci` fails when it drops below.
 */
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        'src/app/domain/**/*.ts': { statements: 95, branches: 95, functions: 95, lines: 95 },
      },
    },
  },
});
