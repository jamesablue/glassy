import { expect, type Locator, type Page } from '@playwright/test';
import expected from '../../src/testing/fixtures/spot-forecast.expected.json';
import { OAHU_SPOTS } from '../../src/app/domain/spots';

/** Problems the page reported: console errors and uncaught exceptions. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** The ranked list of spots in the side panel. */
export function ranking(page: Page): Locator {
  return page.getByRole('list', { name: 'Spots from best to worst' });
}

/** A spot's row in the ranking, found by its name like a screen reader user would. */
export function rankingRow(page: Page, name: string): Locator {
  return ranking(page).getByRole('button', { name: new RegExp(`^${escape(name)}`) });
}

/** The ranking's spot names, top to bottom. */
export function rankedNames(page: Page): Promise<string[]> {
  return ranking(page).locator('.name').allTextContents();
}

/** The names the golden fixture ranks first to last at a forecast hour. */
export function expectedRanking(hour: number): string[] {
  return (expected.rankings[hour] ?? []).map(
    (id) => OAHU_SPOTS.find((spot) => spot.id === id)?.name ?? id,
  );
}

/** The ranking's header, which folds the list and says which hour it ranks. */
export function rankingHeader(page: Page): Locator {
  return page.getByRole('button', { name: /^Best snorkeling/ });
}

/** Unfolds the ranking if it is folded, as it starts on a phone. */
export async function showRanking(page: Page): Promise<void> {
  const header = rankingHeader(page);
  await expect(header).toBeVisible();
  if ((await header.getAttribute('aria-expanded')) === 'false') await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
}

/** The timeline slider. */
export function timeline(page: Page): Locator {
  return page.getByRole('slider', { name: 'Forecast hour' });
}

/** Clicks the timeline in the middle of a forecast hour. */
export async function clickHour(page: Page, hour: number, hourCount = 48): Promise<void> {
  const box = await timeline(page).boundingBox();
  if (!box) throw new Error('The timeline is not on screen');
  await page.mouse.click(box.x + (box.width * (hour + 0.5)) / hourCount, box.y + box.height / 2);
}

/** A button in the map menu, by its label. */
export function menuButton(page: Page, name: string): Locator {
  return page.getByRole('navigation', { name: 'Map controls' }).getByRole('button', {
    name,
    exact: true,
  });
}

/** The legend's unit cell. */
export function legendUnit(page: Page): Locator {
  return page.locator('glassy-legend .unit');
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
