import { expect, type Page, type Route } from '@playwright/test';
import { RECORDED_MORNING } from './clock';
import { waitForForecast } from './glassy';
import { forecastUrl, OPEN_METEO, type ForecastRequest } from './recorded-forecast';

const HOUR_MS = 3_600_000;

/** A forecast request the test is holding back, as a slow or hung service would. */
export interface HeldRequest {
  /** Resolves once the app has sent the request and it is being held. */
  readonly sent: Promise<void>;
  /**
   * Lets the held request through to the recorded response, and every later one straight away:
   * the service answers again. A request the app has given up on in the meantime stays cancelled.
   */
  release(): Promise<void>;
}

/**
 * Holds one of the four forecast requests without answering until {@link HeldRequest.release}, so
 * a test decides how slow the service is. Time on the page can be moved on meanwhile with
 * `page.clock.fastForward`, which runs the app's timers (its retries and its request timeout)
 * without the test waiting for real. Register it after `serveOffline`, so it is asked first.
 */
export async function holdForecastRequest(
  page: Page,
  request: ForecastRequest,
): Promise<HeldRequest> {
  const held: Route[] = [];
  let released = false;
  let sent: () => void = () => undefined;
  const sentPromise = new Promise<void>((resolve) => (sent = resolve));
  await page.route(forecastUrl(request), (route) => {
    if (released) return route.fallback();
    held.push(route);
    sent();
    // Not answered here: the request stays pending until release() falls back for it.
    return undefined;
  });
  return {
    sent: sentPromise,
    async release() {
      released = true;
      await Promise.all(held.splice(0).map((route) => route.fallback().catch(() => undefined)));
    },
  };
}

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
 * Visits the app so it caches the recorded forecast, then moves the clock on two hours: past the
 * cache's 45 minutes, within its 12. Reloading after this is a returning visit with a stale cache,
 * which shows the cached forecast at once and refreshes it in the background.
 */
export async function cacheForecastAndComeBackLater(page: Page): Promise<void> {
  await page.goto('/');
  await waitForForecast(page);
  await expect.poll(() => hasCachedForecast(page)).toBe(true);
  await page.clock.setSystemTime(new Date(RECORDED_MORNING.getTime() + 2 * HOUR_MS));
}

/**
 * A returning visit two hours after the last one, when the forecast cannot be refreshed (see
 * {@link cacheForecastAndComeBackLater}): Open-Meteo fails, so the app keeps the cached forecast
 * and says it is stale.
 */
export async function showStaleForecast(page: Page): Promise<void> {
  await cacheForecastAndComeBackLater(page);
  await failForecastRequests(page);
  await page.reload();
}
