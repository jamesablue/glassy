import type { Page } from '@playwright/test';
import { serveBlankTiles, serveRecordedBathymetry } from './map-sources';
import { serveRecordedForecast } from './recorded-forecast';

/**
 * Runs the app without the internet: recorded forecasts and depths, blank map tiles, and any other
 * request to another host aborted, so a test can never depend on a live service by accident.
 */
export async function serveOffline(page: Page): Promise<void> {
  // Registered first, so it only answers what the more specific routes below leave alone.
  await page.route(
    (url) => url.hostname !== 'localhost',
    (route) => route.abort('blockedbyclient'),
  );
  await serveRecordedForecast(page);
  await serveRecordedBathymetry(page);
  await serveBlankTiles(page);
}
