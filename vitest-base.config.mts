import { defineConfig } from 'vitest/config';

/**
 * Vitest settings merged into the Angular unit-test builder (`runnerConfig` in angular.json).
 * The domain layer is pure logic with no framework code, so it carries the strictest coverage floor;
 * the data layer, where HTTP, caching and parsing failures hide, has one of its own.
 * `npm run test:ci` fails when either drops below.
 */
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        'src/app/domain/**/*.ts': { statements: 95, branches: 95, functions: 95, lines: 95 },
        'src/app/data/**/*.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
      },
    },
  },
});
