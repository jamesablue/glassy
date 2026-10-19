import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import manifest from '../../src/testing/fixtures/raw/manifest.json';

const RAW_FIXTURES = join(__dirname, '../../src/testing/fixtures/raw');
/** Open-Meteo's forecast and marine APIs. */
export const OPEN_METEO = /^https:\/\/([a-z-]+\.)?open-meteo\.com\//;

/** Recorded response bodies by the exact URL the app requests (see `manifest.json`). */
const RECORDED = new Map(
  Object.values(manifest.openMeteo.requests).map(({ url, file }) => [
    url,
    readFileSync(join(RAW_FIXTURES, file), 'utf8'),
  ]),
);

/**
 * Answers the app's Open-Meteo requests with the recorded responses, so end-to-end tests run
 * offline and see the same forecast every time. Any other Open-Meteo request gets a 404 instead of
 * reaching the live API.
 */
export async function serveRecordedForecast(page: Page): Promise<void> {
  await page.route(OPEN_METEO, (route) => {
    const body = RECORDED.get(route.request().url());
    return body === undefined
      ? route.fulfill({ status: 404, json: { error: true, reason: 'Not a recorded request' } })
      : route.fulfill({ status: 200, contentType: 'application/json', body });
  });
}
