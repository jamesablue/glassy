import {
  clickHour,
  collectErrors,
  legendItems,
  legendUnit,
  menuButton,
  rankingRow,
  showRanking,
  SPOT_COUNT,
  spotHeading,
} from './support/glassy';
import { expect, test, type Page } from './support/test';

/** The Units popover's choice for one kind of value, by its visible label. */
function unitChoice(page: Page, group: string, unit: string) {
  return page
    .getByRole('dialog', { name: 'Units' })
    .getByRole('radiogroup', { name: group })
    .getByRole('radio', { name: unit, exact: true });
}

test.describe('layers and legend', () => {
  test('switching the layer switches the legend', async ({ page }) => {
    await page.goto('/');
    await expect(menuButton(page, 'Waves')).toHaveAttribute('aria-pressed', 'true');
    await expect(legendUnit(page)).toHaveText('ft');

    await menuButton(page, 'Wind').click();
    await expect(menuButton(page, 'Wind')).toHaveAttribute('aria-pressed', 'true');
    await expect(menuButton(page, 'Waves')).toHaveAttribute('aria-pressed', 'false');
    await expect(legendUnit(page)).toHaveText('kt');
    await expect(page).toHaveURL(/[?&]layer=wind(&|$)/);

    await menuButton(page, 'Swell period').click();
    await expect(legendUnit(page)).toHaveText('s');

    await menuButton(page, 'Depth').click();
    await expect(legendItems(page)).toHaveCount(12);
    await expect(page.locator('.field-canvas')).toBeHidden();
  });

  test('the Spots button hides and shows the pins', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('glassy-spot-pin')).toHaveCount(SPOT_COUNT);
    await menuButton(page, 'Spots').click();
    await expect(menuButton(page, 'Spots')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('glassy-spot-pin')).toHaveCount(0);
    await menuButton(page, 'Spots').click();
    await expect(page.locator('glassy-spot-pin')).toHaveCount(SPOT_COUNT);
  });
});

test.describe('popovers', () => {
  test('switching units turns feet into metres in the ranking', async ({ page }) => {
    await page.goto('/');
    await showRanking(page);
    await expect(rankingRow(page, 'Hanauma Bay')).toContainText(' ft ·');

    await menuButton(page, 'Units').click();
    const units = page.getByRole('dialog', { name: 'Units' });
    await expect(units).toBeVisible();
    await expect(unitChoice(page, 'Waves & depth', 'ft')).toBeChecked();

    await unitChoice(page, 'Waves & depth', 'm').click();
    await unitChoice(page, 'Wind', 'km/h').click();
    await expect(unitChoice(page, 'Waves & depth', 'm')).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(units).toBeHidden();

    await expect(rankingRow(page, 'Hanauma Bay')).toContainText(' m ·');
    await expect(rankingRow(page, 'Hanauma Bay')).toContainText('km/h');
    await expect(rankingRow(page, 'Hanauma Bay')).not.toContainText(' ft');
    await expect(legendUnit(page)).toHaveText('m');

    // Remembered for the next visit.
    await page.reload();
    await showRanking(page);
    await expect(rankingRow(page, 'Hanauma Bay')).toContainText(' m ·');
  });

  test('About opens, closes on Escape and on a click outside, one popover at a time', async ({
    page,
  }) => {
    await page.goto('/');
    const about = page.getByRole('dialog', { name: 'How this works' });
    const units = page.getByRole('dialog', { name: 'Units' });

    await menuButton(page, 'About').click();
    await expect(about).toBeVisible();
    await expect(about.getByRole('link', { name: 'Open-Meteo' })).toBeVisible();
    await expect(about).toContainText('When in doubt');
    await page.keyboard.press('Escape');
    await expect(about).toBeHidden();

    await menuButton(page, 'About').click();
    await expect(about).toBeVisible();
    await menuButton(page, 'Units').click();
    await expect(units).toBeVisible();
    await expect(about).toBeHidden();

    await page.mouse.click(640, 500);
    await expect(units).toBeHidden();
  });

  test('Escape closes an open popover before the spot details', async ({ page }) => {
    await page.goto('/?spot=hanauma');
    const detail = spotHeading(page, 'Hanauma Bay');
    await expect(detail).toBeVisible();

    await menuButton(page, 'Units').click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Units' })).toBeHidden();
    await expect(detail).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(detail).toBeHidden();
  });
});

test('a full visit logs no console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await showRanking(page);

  await rankingRow(page, 'Hanauma Bay').click();
  await expect(spotHeading(page, 'Hanauma Bay')).toBeVisible();
  await clickHour(page, 30);
  await page.getByRole('button', { name: 'Back to list' }).click();

  await menuButton(page, 'Wind').click();
  await menuButton(page, 'Depth').click();
  await menuButton(page, 'Particles').click();
  await menuButton(page, 'Units').click();
  await unitChoice(page, 'Temperature', '°C').click();
  await page.keyboard.press('Escape');
  await menuButton(page, 'About').click();
  await expect(page.getByRole('dialog', { name: 'How this works' })).toContainText('Open-Meteo');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Play forecast' }).click();
  await page.getByRole('button', { name: 'Pause forecast' }).click();

  expect(errors).toEqual([]);
});
