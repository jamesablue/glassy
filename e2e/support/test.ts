import { test as base } from '@playwright/test';
import { serveOffline } from './offline';

/**
 * Playwright's `test`, with every page offline before the test starts: recorded forecasts and
 * depths, blank map tiles, every other host blocked and the clock on the recorded morning (see
 * {@link serveOffline}). Specs import `test` and `expect` from here, never from
 * `@playwright/test`, so none of them can reach the live services.
 *
 * Routes a test adds later are asked first, so a test can still make a request fail on purpose
 * (see `failForecastRequests`).
 */
// Not called `offline`: Playwright already has an option by that name (the browser's offline mode).
export const test = base.extend<{ recordedNetwork: void }>({
  recordedNetwork: [
    async ({ page }, use) => {
      await serveOffline(page);
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
export type { Locator, Page } from '@playwright/test';
