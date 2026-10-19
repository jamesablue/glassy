import { legendItems, legendUnit, menuButton, spotHeading, timeline } from './support/glassy';
import { expect, test } from './support/test';

test.describe('shared link', () => {
  test('restores the spot, the layer and the hour', async ({ page }) => {
    await page.goto('/?spot=hanauma&layer=depth&t=2026-10-19T12');

    await expect(spotHeading(page, 'Hanauma Bay')).toBeVisible();
    await expect(menuButton(page, 'Depth')).toHaveAttribute('aria-pressed', 'true');
    await expect(legendUnit(page)).toHaveText('ft');
    await expect(legendItems(page)).toHaveCount(12);
    await expect(legendItems(page).last()).toHaveText('1640');
    await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Mon 12 PM');
    await expect(page).toHaveURL(/\/\?spot=hanauma&layer=depth&t=2026-10-19T12$/);
  });

  test('keeps what it recognises and drops the rest', async ({ page }) => {
    await page.goto('/?spot=hanauma&layer=depth&t=yesterday');

    await expect(page).toHaveURL(/\/\?spot=hanauma&layer=depth$/);
    await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Sun 8 AM');
  });

  test('follows the view as it changes', async ({ page }) => {
    await page.goto('/');
    await menuButton(page, 'Wind').click();
    await expect(page).toHaveURL(/\/\?layer=wind$/);

    await timeline(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/[?&]t=2026-10-18T09(&|$)/);

    await page.keyboard.press('End');
    await expect(page).toHaveURL(/[?&]t=2026-10-19T23(&|$)/);
  });
});
