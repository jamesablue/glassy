import {
  legendItems,
  menuButton,
  showRanking,
  spotHeading,
  waitForForecast,
} from './support/glassy';
import { devices, expect, test } from './support/test';

/*
 * Screenshot comparisons of a few stable views. They run in the `visual` project only (E2E_VISUAL=1,
 * in the Playwright Linux image), with reduced motion, so there are no particles or map flights,
 * against the recorded forecast, blank map tiles and the pinned clock, so every run draws the same
 * pixels. The baselines live in visual.spec.ts-snapshots/; e2e/README.md says how to update them.
 */

test.describe('visual', () => {
  test('the ranking', async ({ page }) => {
    await page.goto('/');
    await showRanking(page);
    await waitForForecast(page);
    await expect(page).toHaveScreenshot('ranking.png');
  });

  test('Hanauma Bay’s details', async ({ page }) => {
    await page.goto('/?spot=hanauma');
    await expect(spotHeading(page, 'Hanauma Bay')).toBeVisible();
    await expect(
      page.getByRole('slider', { name: 'Snorkel score and surf by hour' }),
    ).toBeVisible();
    await waitForForecast(page);
    await expect(page).toHaveScreenshot('spot-detail-hanauma.png');
  });

  test('the depth layer', async ({ page }) => {
    await page.goto('/?layer=depth');
    await expect(legendItems(page)).toHaveCount(12);
    await waitForForecast(page);
    await expect(page).toHaveScreenshot('depth-layer.png');
  });

  test('the Units popover', async ({ page }) => {
    await page.goto('/');
    await waitForForecast(page);
    await menuButton(page, 'Units').click();
    await expect(page.getByRole('dialog', { name: 'Units' })).toBeVisible();
    await expect(page).toHaveScreenshot('units-popover.png');
  });

  test.describe('on a phone', () => {
    const { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent } = devices['Pixel 7'];
    test.use({ viewport, deviceScaleFactor, isMobile, hasTouch, userAgent });

    test('the ranking', async ({ page }) => {
      await page.goto('/');
      await showRanking(page);
      await waitForForecast(page);
      await expect(page).toHaveScreenshot('phone-ranking.png');
    });
  });
});
