import { menuButton, ranking, rankingHeader, rankingRow, SPOT_COUNT } from './support/glassy';
import { expect, test } from './support/test';

test.skip(({ isMobile }) => !isMobile, 'The phone layout');

test.describe('phone layout', () => {
  test('starts with the ranking folded, so the map shows, and unfolds it on request', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(rankingHeader(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(rankingHeader(page)).toContainText('Sun 8 AM');
    await expect(ranking(page)).toBeHidden();

    await rankingHeader(page).click();
    await expect(rankingHeader(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(ranking(page)).toBeVisible();
    await expect(ranking(page).getByRole('listitem')).toHaveCount(SPOT_COUNT);
    await expect(rankingRow(page, 'Pōkaʻi Bay')).toBeInViewport();

    await rankingHeader(page).click();
    await expect(ranking(page)).toBeHidden();
  });

  test('sits the panel above the timeline, clear of the menu on the right', async ({ page }) => {
    await page.goto('/');
    await rankingHeader(page).click();
    const viewport = page.viewportSize();
    const panel = await page.locator('glassy-panel.side').boundingBox();
    const timeline = await page.locator('glassy-timeline').boundingBox();
    const menu = await page.getByRole('navigation', { name: 'Map controls' }).boundingBox();
    if (!viewport || !panel || !timeline || !menu) throw new Error('Layout not on screen');

    expect(panel.y + panel.height).toBeLessThanOrEqual(timeline.y);
    expect(panel.height).toBeLessThanOrEqual(viewport.height * 0.46 + 1);
    expect(panel.x + panel.width).toBeLessThanOrEqual(menu.x + menu.width);
  });

  test('keeps the menu to icons, still named for screen readers', async ({ page }) => {
    await page.goto('/');
    await expect(menuButton(page, 'Swell period')).toBeVisible();
    const label = menuButton(page, 'Swell period').locator('.label');
    expect(await label.evaluate((element) => element.getBoundingClientRect().width)).toBe(1);
    await expect(page.getByText('Oahu snorkel forecast')).toBeHidden();
  });
});
