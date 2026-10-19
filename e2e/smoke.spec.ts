import { expect, test } from '@playwright/test';
import { serveRecordedForecast } from './support/recorded-forecast';

test.beforeEach(async ({ page }) => {
  await serveRecordedForecast(page);
});

test.describe('app shell', () => {
  test('loads with the brand and tagline', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Glassy/);
    await expect(page.getByRole('heading', { level: 1, name: 'Glassy' })).toBeVisible();
    await expect(page.getByText('Oahu snorkel forecast')).toBeVisible();
  });
});

test.describe('shareable URL', () => {
  test('keeps a shared view in the URL and drops what it does not recognise', async ({ page }) => {
    await page.goto('/?spot=hanauma&layer=depth&t=yesterday');

    await expect(page).toHaveURL(/\/\?spot=hanauma&layer=depth$/);
  });
});
