import { expect, type Locator, type Page } from '@playwright/test';
import expected from '../../src/testing/fixtures/spot-forecast.expected.json';
import { OAHU_SPOTS } from '../../src/app/domain/spots';

/** How many spots the app ranks and pins: the whole catalog. */
export const SPOT_COUNT = OAHU_SPOTS.length;

/** Problems the page reported: console errors and uncaught exceptions. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/**
 * Errors the app itself reported, for tests that make requests fail on purpose. The browser also
 * logs every request that failed ("Failed to load resource"), which is the point of those tests
 * rather than a fault.
 */
export function appErrors(page: Page): () => string[] {
  const errors = collectErrors(page);
  return () => errors.filter((error) => !error.startsWith('Failed to load resource'));
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

/** The legend's colour stops, or its depth classes on the depth layer. */
export function legendItems(page: Page): Locator {
  return page.locator('glassy-legend li');
}

/** Every spot pin on the map. */
export function spotPins(page: Page): Locator {
  return page.locator('glassy-spot-pin button');
}

/**
 * A spot's pin, found the way a screen reader user would: by its name, which starts the label. The
 * ranking has a button per spot too, so the search stays on the map.
 */
export function spotPin(page: Page, name: string): Locator {
  return page.locator('glassy-map').getByRole('button', { name: new RegExp(`^${escape(name)}`) });
}

/**
 * Waits until the whole forecast has loaded: every spot has its pin on the map, and the map grid,
 * which can arrive after the spots, is in (the "Loading map layers…" chip has gone).
 */
export async function waitForForecast(page: Page): Promise<void> {
  await expect(spotPins(page)).toHaveCount(SPOT_COUNT);
  await expect(page.locator('glassy-map-layers-chip')).toHaveCount(0);
}

/** The heading of the open spot's details. */
export function spotHeading(page: Page, name: string): Locator {
  return page.getByRole('heading', { level: 2, name });
}

/** The forecast and depth readout the map shows where it was tapped. */
export function pointReadout(page: Page): Locator {
  return page.locator('.leaflet-popup glassy-point-readout');
}

/**
 * Taps open sea at the top of the screen, clear of the panels around the map. On the recorded
 * forecast the depth there is NOAA's Hanauma Bay recording (see `serveRecordedBathymetry`).
 */
export async function tapOpenSea(page: Page): Promise<void> {
  const width = page.viewportSize()?.width ?? 0;
  await page.mouse.click(width / 2, 20);
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
