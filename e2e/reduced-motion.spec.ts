import { expect, test, type Page } from '@playwright/test';
import { rankingHeader, rankingRow, showRanking } from './support/glassy';
import { serveOffline } from './support/offline';

/** How much has been drawn on the particle canvas: the sum of its alpha channel. */
function particleInk(page: Page): Promise<number> {
  return page.locator('.particle-canvas').evaluate((canvas: HTMLCanvasElement) => {
    if (!canvas.width || !canvas.height) return 0;
    const pixels = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
    let ink = 0;
    for (let i = 3; i < (pixels?.length ?? 0); i += 4) ink += pixels?.[i] ?? 0;
    return ink;
  });
}

/** Where a spot's pin is on screen. */
async function pinPosition(page: Page, name: string): Promise<{ x: number; y: number }> {
  const box = await page
    .locator('glassy-map')
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .boundingBox();
  if (!box) throw new Error(`${name} is not on screen`);
  return { x: Math.round(box.x), y: Math.round(box.y) };
}

test.beforeEach(async ({ page }) => {
  await serveOffline(page);
});

test.describe('with motion', () => {
  test('animates the particles and flies to a selected spot', async ({ page }) => {
    await page.goto('/');
    await expect.poll(() => particleInk(page)).toBeGreaterThan(0);

    await showRanking(page);
    await rankingRow(page, 'Hanauma Bay').click();
    const start = await pinPosition(page, 'Hanauma Bay');
    await page.waitForTimeout(1200);
    expect(await pinPosition(page, 'Hanauma Bay')).not.toEqual(start);
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('draws no particles', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('glassy-spot-pin button')).toHaveCount(25);
    await page.waitForTimeout(800);
    expect(await particleInk(page)).toBe(0);
  });

  test('moves to a selected spot at once instead of flying', async ({ page }) => {
    await page.goto('/');
    await showRanking(page);
    await rankingRow(page, 'Hanauma Bay').click();
    await expect(page.getByRole('heading', { level: 2, name: 'Hanauma Bay' })).toBeVisible();

    const landed = await pinPosition(page, 'Hanauma Bay');
    await page.waitForTimeout(1200);
    expect(await pinPosition(page, 'Hanauma Bay')).toEqual(landed);
  });

  test('turns off transitions and never starts playing by itself', async ({ page }) => {
    await page.goto('/');
    await expect(rankingHeader(page)).toBeVisible();
    const transition = await page
      .locator('glassy-spot-ranking-panel .chevron')
      .evaluate((chevron) => getComputedStyle(chevron).transitionDuration);
    expect(transition).toBe('0s');
    await expect(page.locator('.field-canvas')).toHaveCSS('transition-duration', '0s');
    await expect(page.getByRole('button', { name: 'Play forecast' })).toBeVisible();
  });
});
