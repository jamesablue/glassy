import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env['CI'];
/**
 * Runs the screenshot comparisons (`e2e/visual.spec.ts`) instead of the functional suites. Text is
 * drawn with the system's fonts, so the baselines only match in the environment they were taken
 * in: the Playwright Linux image. `npm run e2e:visual` runs them there through Docker, and CI runs
 * them in the same image.
 */
const visual = !!process.env['E2E_VISUAL'];
/** CI and the visual run test the production build (`npm run build`); local runs use `ng serve`. */
const servesBuild = isCI || visual;
const port = Number(process.env['E2E_PORT'] ?? 4300);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : '50%',
  // In CI each job writes a blob report; the E2E job merges them into one HTML report.
  reporter: isCI ? [['github'], ['blob']] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  expect: {
    toHaveScreenshot: {
      // Room for anti-aliasing noise, not for a moved or restyled element.
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  snapshotPathTemplate: '{testDir}/{testFileName}-snapshots/{arg}-{platform}{ext}',
  projects: visual
    ? [
        {
          name: 'visual',
          testMatch: 'visual.spec.ts',
          // Reduced motion stops the particles and map flights, so every frame is the same.
          use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce' },
        },
      ]
    : [
        {
          name: 'chromium',
          testIgnore: 'visual.spec.ts',
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'mobile',
          testIgnore: 'visual.spec.ts',
          use: { ...devices['Pixel 7'] },
        },
      ],
  webServer: servesBuild
    ? {
        command: `node e2e/support/serve-build.mts ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 10_000,
      }
    : {
        command: `npx ng serve --port ${port}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
