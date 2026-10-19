import { expect, test } from '@playwright/test';
import { RECORDED_MORNING_HOUR } from './support/clock';
import {
  clickHour,
  expectedRanking,
  rankedNames,
  rankingHeader,
  showRanking,
  timeline,
} from './support/glassy';
import { serveOffline } from './support/offline';

test.beforeEach(async ({ page }) => {
  await serveOffline(page);
});

test.describe('timeline', () => {
  test('opens on the current hour with its ranking', async ({ page }) => {
    await page.goto('/');
    await showRanking(page);

    await expect(timeline(page)).toHaveAttribute('aria-valuenow', String(RECORDED_MORNING_HOUR));
    await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Sun 8 AM');
    await expect(rankingHeader(page)).toContainText('Sun 8 AM');
    expect(await rankedNames(page)).toEqual(expectedRanking(RECORDED_MORNING_HOUR));
  });

  test('scrubbing moves the time and re-ranks the spots', async ({ page }) => {
    await page.goto('/');
    await showRanking(page);
    await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Sun 8 AM');

    await clickHour(page, 36);
    await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Mon 12 PM');
    await expect(page.locator('glassy-timeline .handle-label')).toHaveText('Mon 12 PM');
    await expect(rankingHeader(page)).toContainText('Mon 12 PM');
    await expect.poll(() => rankedNames(page)).toEqual(expectedRanking(36));
    expect(expectedRanking(36)).not.toEqual(expectedRanking(RECORDED_MORNING_HOUR));

    await clickHour(page, 2);
    await expect(rankingHeader(page)).toContainText('Sun 2 AM · after dark');
    await expect(page).toHaveURL(/[?&]t=2026-10-18T02(&|$)/);
  });

  test('steps through the hours from the keyboard', async ({ page }) => {
    await page.goto('/');
    await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Sun 8 AM');

    await timeline(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Sun 9 AM');
    await page.keyboard.press('PageUp');
    await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Mon 9 AM');
    await page.keyboard.press('End');
    await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Mon 11 PM');
    await page.keyboard.press('Home');
    await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Sun 12 AM');

    // The app-wide arrows work away from the slider too.
    await timeline(page).blur();
    await page.keyboard.press('ArrowRight');
    await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Sun 1 AM');
  });

  test('plays, pauses and goes back to now', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Sun 8 AM');

    await page.getByRole('button', { name: 'Play forecast' }).click();
    await expect(timeline(page)).not.toHaveAttribute('aria-valuetext', 'Sun 8 AM');
    await page.getByRole('button', { name: 'Pause forecast' }).click();
    await expect(page.getByRole('button', { name: 'Play forecast' })).toBeVisible();

    // Phones have no room for the Now button.
    test.skip(isMobile, 'The Now button is hidden on phones');
    await page.getByRole('button', { name: 'Now', exact: true }).click();
    await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Sun 8 AM');
  });
});
