import {
  appErrors,
  pointReadout,
  ranking,
  rankingHeader,
  rankingRow,
  showRanking,
  SPOT_COUNT,
  tapOpenSea,
  waitForForecast,
} from './support/glassy';
import { ESRI_TILES, NOAA_IDENTIFY, NOAA_TILES } from './support/map-sources';
import { failForecastRequests, showStaleForecast } from './support/states';
import { expect, test } from './support/test';

test.describe('when the forecast cannot be loaded', () => {
  test('says so full screen, and Retry loads it once the service is back', async ({ page }) => {
    const errors = appErrors(page);
    const recover = await failForecastRequests(page);
    await page.goto('/');

    const screen = page.getByRole('alertdialog', { name: "Couldn't load the forecast" });
    await expect(screen).toBeVisible();
    await expect(screen).toContainText('Check your connection and try again.');
    await expect(screen.getByRole('button', { name: 'Retry' })).toBeFocused();

    recover();
    await screen.getByRole('button', { name: 'Retry' }).click();
    await expect(screen).toBeHidden();
    await showRanking(page);
    await expect(ranking(page).getByRole('listitem')).toHaveCount(SPOT_COUNT);
    expect(errors()).toEqual([]);
  });

  test('explains the rate limit', async ({ page }) => {
    await failForecastRequests(page, 429);
    await page.goto('/');
    await expect(
      page.getByRole('alertdialog', { name: 'The forecast service is busy' }),
    ).toContainText('Try again in a minute');
  });

  test('leaves a toast with Retry when the screen is closed', async ({ page }) => {
    await failForecastRequests(page);
    await page.goto('/');
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(page.getByRole('alert')).toContainText("Couldn't load the forecast.");
    await expect(page.getByRole('alert').getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});

test('shows an older forecast when the refresh fails, and says how old', async ({ page }) => {
  await showStaleForecast(page);

  await expect(page.getByRole('status').filter({ hasText: "Couldn't refresh" })).toHaveText(
    "Couldn't refresh the forecast. Showing data from Sun 8 AM.",
  );
  await showRanking(page);
  await expect(page.getByText('Data from Sun 8 AM', { exact: true })).toBeVisible();
  await expect(rankingRow(page, 'Hanauma Bay')).toBeVisible();
});

test('says when the connection drops, and carries on with the forecast on show', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await waitForForecast(page);

  await context.setOffline(true);
  await expect(page.getByRole('status').filter({ hasText: "You're offline" })).toContainText(
    'Showing the forecast from Sun 8 AM',
  );
  await context.setOffline(false);
  await expect(page.getByRole('status').filter({ hasText: "You're offline" })).toBeHidden();
  await expect(rankingHeader(page)).toContainText('Sun 8 AM');
});

test.describe('when map tiles fail', () => {
  test('keeps the map working, says so once, and stops asking for a while', async ({ page }) => {
    const errors = appErrors(page);
    await page.route(ESRI_TILES, (route) => route.fulfill({ status: 503 }));
    await page.route(NOAA_TILES, (route) => route.fulfill({ status: 503 }));
    const tileRequests: string[] = [];
    page.on('request', (request) => {
      if (ESRI_TILES.test(request.url()) || NOAA_TILES.test(request.url())) {
        tileRequests.push(request.url());
      }
    });

    await page.goto('/');
    const notice = page.getByRole('status').filter({ hasText: "Map tiles aren't loading" });
    await expect(notice).toHaveText(
      "Map tiles aren't loading right now. The forecast still works.",
    );
    await waitForForecast(page);

    // The sources are paused: panning asks for no more tiles from them.
    const before = tileRequests.length;
    const map = page.getByRole('main', { name: 'Forecast map' });
    await map.focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(500);
    expect(tileRequests.length).toBe(before);
    expect(errors()).toEqual([]);
  });
});

test('shows a dash with the reason when the depth lookup fails', async ({ page }) => {
  const errors = appErrors(page);
  await page.route(NOAA_IDENTIFY, (route) => route.fulfill({ status: 500 }));
  await page.goto('/?layer=wind');
  await waitForForecast(page);
  await tapOpenSea(page);

  const depth = pointReadout(page).locator('.depth dd');
  await expect(depth).toContainText('—');
  await expect(depth).toHaveAttribute('title', /Couldn’t get the depth from NOAA/);
  expect(errors()).toEqual([]);
});
