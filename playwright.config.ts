import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env['CI'];
/** CI tests the production build (`npm run build`); local runs use `ng serve`. */
const servesBuild = isCI;
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
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
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
