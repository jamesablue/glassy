import { expect, test } from './support/test';

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
