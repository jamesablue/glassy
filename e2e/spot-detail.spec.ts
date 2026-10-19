import { expect, test } from '@playwright/test';
import { legendUnit, menuButton, ranking, rankingRow, showRanking } from './support/glassy';
import { serveOffline } from './support/offline';

test.beforeEach(async ({ page }) => {
  await serveOffline(page);
});

test.describe('spot detail', () => {
  test('opens a spot from the ranking, shows its conditions and goes back', async ({ page }) => {
    await page.goto('/');
    await showRanking(page);
    await rankingRow(page, 'Hanauma Bay').click();

    const detail = page.locator('glassy-spot-detail-panel');
    await expect(detail.getByRole('heading', { level: 2, name: 'Hanauma Bay' })).toBeVisible();
    await expect(detail.getByText('South Shore · Beginner')).toBeVisible();
    await expect(detail.locator('glassy-rating-badge')).toHaveText(
      /^(Excellent|Good|Fair|Poor|Hazardous)$/,
    );
    for (const reading of ['Surf at spot', 'Wind', 'Primary swell', 'Water temp', 'Rain chance']) {
      const term = detail.getByRole('term').filter({ hasText: new RegExp(`^${reading}$`) });
      await term.scrollIntoViewIfNeeded();
      await expect(term).toBeVisible();
    }
    await expect(detail.getByRole('img', { name: 'Snorkel score and surf by hour' })).toBeVisible();
    await expect(detail.locator('glassy-best-window')).toHaveText(
      /Best daylight window: Mon 1 PM–4 PM · score \d+\.\d \((excellent|good|fair|poor)\)/,
    );
    await expect(ranking(page)).toBeHidden();
    await expect(page).toHaveURL(/[?&]spot=hanauma(&|$)/);

    await page.getByRole('button', { name: 'Back to list' }).click();
    await expect(detail).toHaveCount(0);
    await expect(ranking(page)).toBeVisible();
    await expect(rankingRow(page, 'Hanauma Bay')).toBeFocused();
    await expect(page).not.toHaveURL(/spot=/);
  });

  test('closes with Escape', async ({ page }) => {
    await page.goto('/?spot=kuilima');
    await expect(page.getByRole('heading', { name: 'Kuilima Cove (Turtle Bay)' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('glassy-spot-detail-panel')).toHaveCount(0);
  });

  test('moves the timeline to an hour picked on the chart', async ({ page }) => {
    await page.goto('/?spot=hanauma');
    const chart = page.locator('glassy-score-trend-chart .plot');
    // On a phone the details scroll inside a short sheet.
    await chart.scrollIntoViewIfNeeded();
    const box = await chart.boundingBox();
    if (!box) throw new Error('The chart is not on screen');
    // The recording has 48 hours; the last quarter of the chart is Monday afternoon and evening.
    await page.mouse.click(box.x + box.width * (36.5 / 48), box.y + box.height / 2);

    await expect(page.getByRole('slider', { name: 'Forecast hour' })).toHaveAttribute(
      'aria-valuetext',
      'Mon 12 PM',
    );
  });

  test('restores a shared link to a spot on the depth layer', async ({ page }) => {
    await page.goto('/?spot=hanauma&layer=depth');

    await expect(page.getByRole('heading', { level: 2, name: 'Hanauma Bay' })).toBeVisible();
    await expect(menuButton(page, 'Depth')).toHaveAttribute('aria-pressed', 'true');
    await expect(legendUnit(page)).toHaveText('ft');
    await expect(page.locator('glassy-legend li')).toHaveCount(12);
    await expect(page.locator('glassy-legend li').last()).toHaveText('1640');
  });
});
