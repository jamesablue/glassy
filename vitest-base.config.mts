import { defineConfig } from 'vitest/config';

/**
 * Vitest settings merged into the Angular unit-test builder (`runnerConfig` in angular.json).
 * The domain layer is pure logic with no framework code, so it carries the strictest coverage
 * floor. The data layer, where HTTP, caching and parsing failures hide, and the state layer, where
 * loading, playback and URL sync interleave, have floors of their own. The map layer drives
 * Leaflet and canvases, which jsdom only partly emulates (there is no layout and no real canvas),
 * so its floor is lower; Playwright covers the rest in a real browser. The shared UI primitives and
 * pipes are small and reused everywhere, so they are held close to the domain's bar; the feature
 * components are tested through the DOM against the recorded forecast, with layout, real pointer
 * input and the browser's popovers left to Playwright.
 * `npm run test:ci` fails when any of them drops below.
 */
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        'src/app/domain/**/*.ts': { statements: 95, branches: 95, functions: 95, lines: 95 },
        'src/app/data/**/*.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/app/state/**/*.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/app/map/**/*.ts': { statements: 80, branches: 80, functions: 80, lines: 80 },
        'src/app/shared/**/*.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/app/features/**/*.ts': { statements: 85, branches: 85, functions: 85, lines: 85 },
      },
    },
  },
});
