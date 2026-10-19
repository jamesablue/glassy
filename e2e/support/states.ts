import { expect, type Page } from '@playwright/test';
import { RECORDED_MORNING } from './clock';

const OPEN_METEO = /^https:\/\/([a-z-]+\.)?open-meteo\.com\//;
const HOUR_MS = 3_600_000;

/**
 * Makes every Open-Meteo request fail with `status` until the returned function is called, after
 * which the recorded responses (`serveOffline`) answer again. Register it after `serveOffline`, so
 * it is asked first.
 */
export async function failForecastRequests(page: Page, status = 500): Promise<() => void> {
  let failing = true;
  await page.route(OPEN_METEO, (route) =>
    failing
      ? route.fulfill({ status, json: { error: true, reason: 'The test made it fail' } })
      : route.fallback(),
  );
  return () => {
    failing = false;
  };
}

/** Whether the app has saved a forecast in IndexedDB (`ForecastCache`). */
function hasCachedForecast(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open('glassy');
        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('forecast')) return resolve(false);
          const read = db.transaction('forecast').objectStore('forecast').get('latest');
          read.onsuccess = () => resolve(read.result !== undefined);
          read.onerror = () => resolve(false);
        };
      }),
  );
}

/**
 * A returning visit two hours after the last one, when the forecast cannot be refreshed: loads the
 * app so it caches the recorded forecast, moves the clock on (past the cache's 45 minutes, within
 * its 12 hours), makes Open-Meteo fail and reloads. The app falls back to the cached forecast and
 * says it is stale.
 */
export async function showStaleForecast(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('glassy-spot-pin button')).toHaveCount(25);
  await expect.poll(() => hasCachedForecast(page)).toBe(true);

  await page.clock.setSystemTime(new Date(RECORDED_MORNING.getTime() + 2 * HOUR_MS));
  await failForecastRequests(page);
  await page.reload();
}
