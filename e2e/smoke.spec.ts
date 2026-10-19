import { expect, test } from '@playwright/test';

test.describe('app shell', () => {
  test('loads with the brand and tagline', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Glassy/);
    await expect(page.getByRole('heading', { level: 1, name: 'Glassy' })).toBeVisible();
    await expect(page.getByText('Oahu snorkel forecast')).toBeVisible();
  });
});
