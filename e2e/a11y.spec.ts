import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './support/axe';
import { menuButton, showRanking } from './support/glassy';
import { serveOffline } from './support/offline';
import { failForecastRequests, showStaleForecast } from './support/states';

test.beforeEach(async ({ page }) => {
  await serveOffline(page);
});

test.describe('accessibility (axe, WCAG 2.2 AA)', () => {
  test('the ranking', async ({ page }) => {
    await page.goto('/');
    await showRanking(page);
    await expect(page.locator('glassy-spot-pin button')).toHaveCount(25);
    await expectNoAxeViolations(page);
  });

  test('a spot’s details', async ({ page }) => {
    await page.goto('/?spot=hanauma');
    await expect(
      page.getByRole('slider', { name: 'Snorkel score and surf by hour' }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('the Units popover', async ({ page }) => {
    await page.goto('/');
    await menuButton(page, 'Units').click();
    await expect(page.getByRole('dialog', { name: 'Units' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('the About popover', async ({ page }) => {
    await page.goto('/');
    await menuButton(page, 'About').click();
    await expect(page.getByRole('dialog', { name: 'How this works' })).toContainText('Open-Meteo');
    await expectNoAxeViolations(page);
  });

  test('the depth layer', async ({ page }) => {
    await page.goto('/?layer=depth');
    await expect(page.locator('glassy-legend li')).toHaveCount(12);
    await expectNoAxeViolations(page);
  });

  test('the point readout', async ({ page }) => {
    await page.goto('/?layer=wind');
    await expect(page.locator('glassy-spot-pin button')).toHaveCount(25);
    const width = page.viewportSize()?.width ?? 0;
    await page.mouse.click(width / 2, 20);
    await expect(page.locator('.leaflet-popup glassy-point-readout .depth dd')).toHaveText('28 ft');
    await expectNoAxeViolations(page);
  });

  test('the load error screen', async ({ page }) => {
    await failForecastRequests(page);
    await page.goto('/');
    await expect(
      page.getByRole('alertdialog', { name: "Couldn't load the forecast" }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('the error toast', async ({ page }) => {
    await failForecastRequests(page);
    await page.goto('/');
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alert')).toContainText('Retry');
    await expectNoAxeViolations(page);
  });

  test('the stale forecast notice', async ({ page }) => {
    await showStaleForecast(page);
    await expect(page.getByRole('status').filter({ hasText: "Couldn't refresh" })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
