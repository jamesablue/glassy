import {
  appErrors,
  ranking,
  rankingRow,
  showRanking,
  SPOT_COUNT,
  spotHeading,
  spotPins,
} from './support/glassy';
import { forecastUrl } from './support/recorded-forecast';
import { cacheForecastAndComeBackLater, holdForecastRequest } from './support/states';
import { expect, test, type Page } from './support/test';

/** The app's default per-request timeout (`forecastRequestTimeoutMs`), ms. */
const REQUEST_TIMEOUT_MS = 25_000;

const fieldLayer = (page: Page) => page.locator('.field-canvas');
const status = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text });

test.describe('when the map grid is slow', () => {
  test('ranks the spots without it, then draws the overlay when it lands', async ({ page }) => {
    const errors = appErrors(page);
    const grid = await holdForecastRequest(page, 'gridWind');
    const spotsAnswered = page.waitForResponse(forecastUrl('spotWeather'));
    await page.goto('/');
    await grid.sent;

    // The spots render within moments of their own responses, with the grid still held.
    await spotsAnswered;
    const answeredAt = Date.now();
    await expect(spotPins(page)).toHaveCount(SPOT_COUNT);
    expect(Date.now() - answeredAt).toBeLessThan(2_000);
    await showRanking(page);
    await expect(ranking(page).getByRole('listitem')).toHaveCount(SPOT_COUNT);
    await expect(status(page, 'Loading map layers…')).toBeVisible();
    await expect(fieldLayer(page)).toBeHidden();

    // 20 s go by on the page's clock: slow, but within the request timeout.
    await page.clock.fastForward(20_000);
    await expect(status(page, 'Loading map layers…')).toBeVisible();

    await grid.release();
    await expect(fieldLayer(page)).toBeVisible();
    await expect(status(page, 'Loading map layers…')).toBeHidden();
    await expect(status(page, 'Map overlay unavailable')).toHaveCount(0);
    expect(errors()).toEqual([]);
  });

  test('keeps the spots working, and says so, when the grid fails', async ({ page }) => {
    const errors = appErrors(page);
    await page.route(forecastUrl('gridWind'), (route) =>
      route.fulfill({ status: 503, json: { error: true, reason: 'The test made it fail' } }),
    );
    await page.goto('/');

    // After the retries (1 s and 2 s), a polite notice rather than an error screen.
    await expect(status(page, 'Map overlay unavailable')).toHaveText(
      'Map overlay unavailable right now. The spot forecast still works.',
      { timeout: 10_000 },
    );
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(status(page, 'Loading map layers…')).toBeHidden();
    await expect(fieldLayer(page)).toBeHidden();

    await showRanking(page);
    await rankingRow(page, 'Hanauma Bay').click();
    await expect(spotHeading(page, 'Hanauma Bay')).toBeVisible();
    expect(errors()).toEqual([]);
  });
});

test.describe('when a forecast request hangs', () => {
  test('stops waiting at the timeout and offers Retry', async ({ page }) => {
    const spots = await holdForecastRequest(page, 'spotWeather');
    await page.goto('/');
    await spots.sent;
    await expect(status(page, 'Loading forecast…')).toBeVisible();

    await page.clock.fastForward(REQUEST_TIMEOUT_MS);
    const screen = page.getByRole('alertdialog', { name: "Couldn't load the forecast" });
    await expect(screen).toBeVisible();

    await spots.release();
    await screen.getByRole('button', { name: 'Retry' }).click();
    await expect(screen).toBeHidden();
    await expect(spotPins(page)).toHaveCount(SPOT_COUNT);
  });

  test('keeps a cached forecast on show, and says it is stale', async ({ page }) => {
    await cacheForecastAndComeBackLater(page);
    const spots = await holdForecastRequest(page, 'spotWeather');
    await page.reload();

    // The cached forecast shows at once, overlay and all, while the refresh waits.
    await showRanking(page);
    await expect(page.getByText('Data from Sun 8 AM', { exact: true })).toBeVisible();
    await expect(status(page, 'Refreshing the forecast…')).toBeVisible();
    await expect(fieldLayer(page)).toBeVisible();

    await spots.sent;
    await page.clock.fastForward(REQUEST_TIMEOUT_MS);
    await expect(status(page, "Couldn't refresh")).toHaveText(
      "Couldn't refresh the forecast. Showing data from Sun 8 AM.",
    );
    await expect(rankingRow(page, 'Hanauma Bay')).toBeVisible();
  });
});

test('a returning visitor sees the cached forecast at once, then the fresh one', async ({
  page,
}) => {
  await cacheForecastAndComeBackLater(page);
  const grid = await holdForecastRequest(page, 'gridWind');
  await page.reload();

  await showRanking(page);
  const dataAge = page.getByText('Data from Sun 8 AM', { exact: true });
  await expect(dataAge).toBeVisible();
  await expect(status(page, 'Refreshing the forecast…')).toBeVisible();

  await grid.sent;
  await grid.release();
  await expect(dataAge).toBeHidden();
  await expect(status(page, 'Refreshing the forecast…')).toBeHidden();
  await expect(fieldLayer(page)).toBeVisible();
});
