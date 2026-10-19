import { expectNoAxeViolations } from './support/axe';
import {
  legendItems,
  menuButton,
  pointReadout,
  showRanking,
  tapOpenSea,
  waitForForecast,
} from './support/glassy';
import { failForecastRequests, showStaleForecast } from './support/states';
import { expect, test } from './support/test';

test.describe('accessibility (axe, WCAG 2.2 AA)', () => {
  // Each test scans the whole page twice (see expectNoAxeViolations). That takes a couple of
  // seconds alone, but with every worker busy it has taken close to the default 30 s.
  test.describe.configure({ timeout: 60_000 });

  test('the ranking has no violations', async ({ page }) => {
    await page.goto('/');
    await showRanking(page);
    await waitForForecast(page);
    await expectNoAxeViolations(page);
  });

  test('a spot’s details have no violations', async ({ page }) => {
    await page.goto('/?spot=hanauma');
    await expect(
      page.getByRole('slider', { name: 'Snorkel score and surf by hour' }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('the Units popover has no violations', async ({ page }) => {
    await page.goto('/');
    await menuButton(page, 'Units').click();
    await expect(page.getByRole('dialog', { name: 'Units' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('the About popover has no violations', async ({ page }) => {
    await page.goto('/');
    await menuButton(page, 'About').click();
    await expect(page.getByRole('dialog', { name: 'How this works' })).toContainText('Open-Meteo');
    await expectNoAxeViolations(page);
  });

  test('the depth layer has no violations', async ({ page }) => {
    await page.goto('/?layer=depth');
    await expect(legendItems(page)).toHaveCount(12);
    await expectNoAxeViolations(page);
  });

  test('the point readout has no violations', async ({ page }) => {
    await page.goto('/?layer=wind');
    await waitForForecast(page);
    await tapOpenSea(page);
    await expect(pointReadout(page).locator('.depth dd')).toHaveText('28 ft');
    await expectNoAxeViolations(page);
  });

  test('the load error screen has no violations', async ({ page }) => {
    await failForecastRequests(page);
    await page.goto('/');
    await expect(
      page.getByRole('alertdialog', { name: "Couldn't load the forecast" }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('the error toast has no violations', async ({ page }) => {
    await failForecastRequests(page);
    await page.goto('/');
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alert')).toContainText('Retry');
    await expectNoAxeViolations(page);
  });

  test('the stale forecast notice has no violations', async ({ page }) => {
    await showStaleForecast(page);
    await expect(page.getByRole('status').filter({ hasText: "Couldn't refresh" })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
