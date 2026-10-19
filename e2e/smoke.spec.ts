import { expect, test } from '@playwright/test';
import { serveOffline } from './support/offline';

test.beforeEach(async ({ page }) => {
  await serveOffline(page);
});

test.describe('app shell', () => {
  test('loads with the brand, and the tagline where there is room for it', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Glassy/);
    await expect(page.getByRole('heading', { level: 1, name: 'Glassy' })).toBeVisible();
    const tagline = page.getByText('Oahu snorkel forecast');
    await (isMobile ? expect(tagline).toBeHidden() : expect(tagline).toBeVisible());
  });

  test('sends an unknown path back to the map with its query', async ({ page }) => {
    await page.goto('/somewhere/else?layer=wind');

    await expect(page).toHaveURL(/\/\?layer=wind$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Glassy' })).toBeVisible();
  });
});

test.describe('shareable URL', () => {
  test('keeps a shared view in the URL and drops what it does not recognise', async ({ page }) => {
    await page.goto('/?spot=hanauma&layer=depth&t=yesterday');

    await expect(page).toHaveURL(/\/\?spot=hanauma&layer=depth$/);
  });
});
