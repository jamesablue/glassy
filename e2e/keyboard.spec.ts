import {
  menuButton,
  pointReadout,
  ranking,
  rankingHeader,
  rankingRow,
  SPOT_COUNT,
  spotHeading,
  spotPin,
  timeline,
  waitForForecast,
} from './support/glassy';
import { expect, test, type Page } from './support/test';

test.skip(({ isMobile }) => isMobile, 'Keyboard use is a desktop scenario');

/** A short name for the focused element: its accessible name or text, and its role. */
function focused(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return 'body';
    const name =
      element.getAttribute('aria-label') ?? element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return `${element.getAttribute('role') ?? element.tagName.toLowerCase()}: ${name}`;
  });
}

/** Presses Tab until `matches` the focused element, and returns every stop on the way. */
async function tabUntil(page: Page, matches: RegExp, limit = 80): Promise<string[]> {
  const stops: string[] = [];
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab');
    const stop = await focused(page);
    stops.push(stop);
    if (matches.test(stop)) return stops;
  }
  throw new Error(`Never reached ${matches} in ${limit} tabs: ${stops.join(' | ')}`);
}

test('Tab goes through the panel, the menu, the timeline and then the map', async ({ page }) => {
  await page.goto('/');
  await expect(ranking(page).getByRole('listitem')).toHaveCount(SPOT_COUNT);

  const stops = await tabUntil(page, /^button: .*, (Excellent|Good|Fair|Poor|Hazardous), surf/);
  const first = (pattern: RegExp): number => stops.findIndex((stop) => pattern.test(stop));
  const order = [
    first(/^button: Best snorkeling/),
    first(/^radio: All/),
    first(/^button: 1\D/),
    first(/^button: Wind/),
    first(/^button: About/),
    first(/^button: Play forecast/),
    first(/^slider: Forecast hour/),
    first(/^main: Forecast map/),
    stops.length - 1,
  ];
  expect(order.every((index) => index >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
});

test('a ranking row opens with Enter, closes with Escape, and the timeline moves with the arrows', async ({
  page,
}) => {
  await page.goto('/');
  await expect(ranking(page).getByRole('listitem')).toHaveCount(SPOT_COUNT);
  await tabUntil(page, /^button: 1\D/);
  const spot = (await page.locator(':focus .name').textContent()) ?? '';
  const row = rankingRow(page, spot);
  await expect(row).toBeFocused();

  // A visible focus ring.
  await expect(row).not.toHaveCSS('outline-style', 'none');

  await page.keyboard.press('Enter');
  const heading = spotHeading(page, spot);
  await expect(heading).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to list' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(heading).toBeHidden();
  await expect(row).toBeFocused();

  await timeline(page).focus();
  await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Sun 8 AM');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Sun 10 AM');
  await page.keyboard.press('ArrowLeft');
  await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Sun 9 AM');
  await expect(rankingHeader(page)).toContainText('Sun 9 AM');
});

test('the chart steps through the hours and reads each one out', async ({ page }) => {
  await page.goto('/?spot=hanauma');
  const chart = page.getByRole('slider', { name: 'Snorkel score and surf by hour' });
  await chart.focus();
  await expect(chart).toHaveAttribute('aria-valuetext', /^Sun 8 AM: score \d+\.\d, \w+; surf /);
  await page.keyboard.press('PageUp');
  await expect(chart).toHaveAttribute('aria-valuetext', /^Mon 8 AM: /);
  await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Mon 8 AM');
});

test('a popover takes focus when it opens and gives it back when it closes', async ({ page }) => {
  await page.goto('/');
  await menuButton(page, 'Units').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Units' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'ft', exact: true })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Units' })).toBeHidden();
  await expect(menuButton(page, 'Units')).toBeFocused();
});

test('the map pans with the arrows without moving the timeline, and Enter reads the sea', async ({
  page,
}) => {
  await page.goto('/');
  await waitForForecast(page);
  const map = page.getByRole('main', { name: 'Forecast map' });
  await map.focus();
  await expect(map).toHaveCSS('outline-style', 'solid');

  const pin = spotPin(page, 'Hanauma Bay');
  const before = await pin.boundingBox();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await pin.boundingBox())?.x).not.toBe(before?.x);
  await expect(timeline(page)).toHaveAttribute('aria-valuetext', 'Sun 8 AM');

  await page.keyboard.press('Enter');
  await expect(pointReadout(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pointReadout(page)).toBeHidden();
});
