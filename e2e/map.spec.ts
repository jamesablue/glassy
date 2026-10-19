import {
  collectErrors,
  pointReadout,
  spotPin,
  tapOpenSea,
  waitForForecast,
} from './support/glassy';
import { NOAA_TILES } from './support/map-sources';
import { expect, test } from './support/test';

/** The rendering rule a NOAA tile request asks for, such as "Hillshade" or "Colormap". */
function rasterFunction(url: string): string | undefined {
  const rule = new URL(url).searchParams.get('renderingRule');
  return rule ? (JSON.parse(rule) as { rasterFunction: string }).rasterFunction : undefined;
}

test.describe('map', () => {
  test('shows a pin for every spot once the forecast loads', async ({ page }) => {
    await page.goto('/');
    await waitForForecast(page);
    await expect(spotPin(page, 'Hanauma Bay')).toHaveAccessibleName(
      /^Hanauma Bay, (Excellent|Good|Fair|Poor|Hazardous), surf /,
    );
  });

  test('selects a spot from its pin and puts it in the URL', async ({ page }) => {
    await page.goto('/');
    await spotPin(page, 'Kuilima Cove').click();

    await expect(page).toHaveURL(/[?&]spot=kuilima(&|$)/);
    await expect(spotPin(page, 'Kuilima Cove')).toHaveAttribute('aria-current', 'true');
  });

  test('selects a spot from the keyboard', async ({ page }) => {
    await page.goto('/');
    await spotPin(page, 'Mākaha').focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/[?&]spot=makaha(&|$)/);
  });

  test('reads out the forecast and depth where the sea is tapped', async ({ page }) => {
    await page.goto('/');
    // Tap open water a little south of Hanauma Bay's pin, above the legend; the dot's centre is
    // 12 × 12 px in.
    const box = await spotPin(page, 'Hanauma Bay').boundingBox();
    if (!box) throw new Error('Hanauma Bay pin is not on screen');
    await page.mouse.click(box.x + 12, box.y + 12 + 40);

    const readout = pointReadout(page);
    await expect(readout).toBeVisible();
    for (const row of ['Wind', 'Waves', 'Swell']) {
      await expect(readout.getByRole('term').filter({ hasText: row })).toBeVisible();
    }
    // NOAA's recorded answer is 8.5 m deep.
    await expect(readout.locator('.depth dd')).toHaveText('28 ft');
    await expect(page).not.toHaveURL(/spot=/);
  });

  test('asks NOAA for depth tiles on the depth layer only', async ({ page }) => {
    const rules = new Set<string | undefined>();
    page.on('request', (request) => {
      if (NOAA_TILES.test(request.url())) rules.add(rasterFunction(request.url()));
    });

    await page.goto('/');
    await waitForForecast(page);
    expect(rules).toContain('Hillshade');
    expect(rules).not.toContain('Colormap');

    const depthTile = page.waitForRequest(
      (request) => NOAA_TILES.test(request.url()) && rasterFunction(request.url()) === 'Colormap',
    );
    await page.goto('/?layer=depth');
    await depthTile;
    await expect(page.locator('.field-canvas')).toBeHidden();
  });

  test('loads and runs without console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/?layer=wind');
    await waitForForecast(page);
    await tapOpenSea(page);
    await expect(pointReadout(page)).toBeVisible();

    expect(errors).toEqual([]);
  });
});
