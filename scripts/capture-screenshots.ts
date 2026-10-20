/**
 * Captures the README screenshots in `docs/images/` from the production build, so they can be
 * taken again whenever the UI changes instead of being made by hand.
 *
 * - The forecast is the recorded one the tests use: Open-Meteo and NOAA depth lookups are answered
 *   from `src/testing/fixtures/raw/` (the routes in `e2e/support/`), and the clock starts on the
 *   recording's morning, so the images show the same hour and ranking as the end-to-end tests.
 * - Map tiles are real: Esri's basemap and NOAA's land and depth tiles load from the live servers,
 *   so this needs network access to those two hosts. Every other outside request is blocked.
 * - Desktop shots are 1440 × 900 CSS pixels at 2× and the phone shots 390 × 844 at 2×. Each PNG
 *   is reduced to a 256-colour palette (`png-palette.ts`) that keeps the rating colours exact, which
 *   keeps it near 400 kB.
 * - Only the wind shot shows the particles. Their trails cover the whole map with fine detail that
 *   no palette compresses well (about 1.2 MB at 2×), so that one is taken at 1×, which is still
 *   sharper than the README's screenshot grid shows it. The other shots run with reduced motion:
 *   no particles, and map moves that land at once.
 *
 * Usage: `npm run docs:screenshots` (builds the app first, then runs this script).
 */
import { chromium, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startAtRecordedMorning } from '../e2e/support/clock';
import { ESRI_TILES, NOAA_TILES, serveRecordedBathymetry } from '../e2e/support/map-sources';
import { serveRecordedForecast } from '../e2e/support/recorded-forecast';
import { RATINGS } from '../src/app/domain/scoring/rating';
import { OAHU_SPOTS } from '../src/app/domain/spots/oahu.spots';
import { toPalettePng } from './png-palette';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT_DIR = new URL('../docs/images/', import.meta.url);
const PORT = Number(process.env['SCREENSHOT_PORT'] ?? 4310);
const BASE_URL = `http://localhost:${PORT}`;

const DESKTOP: BrowserContextOptions = {
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
};
const DESKTOP_1X: BrowserContextOptions = { ...DESKTOP, deviceScaleFactor: 1 };
const PHONE: BrowserContextOptions = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

/** How long to let tiles fade in (and particle trails build up) before taking a picture, ms. */
const SETTLE_MS = 3000;
/** How long to wait for the live tile servers before taking the picture anyway, ms. */
const TILE_TIMEOUT_MS = 45_000;
/** Where a spot pin's dot, and so the spot, sits from the pin's top left corner, CSS pixels. */
const PIN_DOT_OFFSET = 12;
/** Colours that must survive the palette exactly: the rating badges and pins. */
const KEEP_COLORS = RATINGS.map((rating) => rating.color);

interface Shot {
  readonly file: string;
  readonly context: BrowserContextOptions;
  readonly path: string;
  /** Show the particles. Off, the page runs with reduced motion. */
  readonly particles?: boolean;
  /** Anything to do once the forecast has loaded, before waiting for the tiles. */
  readonly prepare?: (page: Page) => Promise<void>;
}

const SHOTS: readonly Shot[] = [
  // The ranking on the default waves layer.
  { file: 'hero.png', context: DESKTOP, path: '/' },
  { file: 'spot-detail.png', context: DESKTOP, path: '/?spot=hanauma', prepare: hanaumaDetails },
  // The depth layer with the point readout open in Hanauma Bay.
  {
    file: 'depth-layer.png',
    context: DESKTOP,
    path: '/?layer=depth&spot=hanauma',
    prepare: inspectHanaumaBay,
  },
  { file: 'wind-layer.png', context: DESKTOP_1X, path: '/?layer=wind', particles: true },
  // The phone layout: the map with the folded ranking sheet, then a spot's details.
  { file: 'phone.png', context: PHONE, path: '/' },
  { file: 'phone-detail.png', context: PHONE, path: '/?spot=hanauma', prepare: hanaumaDetails },
];

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS) await capture(browser, shot);
  } finally {
    await browser.close();
    server.kill();
  }
}

async function capture(browser: Browser, shot: Shot): Promise<void> {
  const context = await browser.newContext({
    ...shot.context,
    colorScheme: 'dark',
    reducedMotion: shot.particles ? 'no-preference' : 'reduce',
  });
  const page = await context.newPage();
  await useRecordedForecast(page);
  await page.goto(`${BASE_URL}${shot.path}`);
  await waitForForecast(page);
  await shot.prepare?.(page);
  await waitForTiles(page, shot.file);
  await page.waitForTimeout(SETTLE_MS);

  const png = toPalettePng(await page.screenshot(), { keep: KEEP_COLORS });
  await writeFile(new URL(shot.file, OUT_DIR), png);
  console.log(`${shot.file}: ${Math.round(png.length / 1024)} kB`);
  await context.close();
}

/**
 * The recorded forecast and depth lookups and the recording's clock, as in the end-to-end tests,
 * but with the live map tiles. Registered first, the catch-all only sees what the routes after it
 * leave alone, so a request nobody expected fails instead of reaching a live service.
 */
async function useRecordedForecast(page: Page): Promise<void> {
  await page.route(
    (url) =>
      url.hostname !== 'localhost' && !ESRI_TILES.test(url.href) && !NOAA_TILES.test(url.href),
    (route) => route.abort('blockedbyclient'),
  );
  await serveRecordedForecast(page);
  await serveRecordedBathymetry(page);
  await startAtRecordedMorning(page);
}

/** Waits until every spot has its pin, which means the forecast has loaded and been scored. */
async function waitForForecast(page: Page): Promise<void> {
  await page.waitForFunction(
    (count) => document.querySelectorAll('glassy-spot-pin button').length === count,
    OAHU_SPOTS.length,
  );
}

/** Waits until every map tile in view has loaded, or warns and carries on after a while. */
async function waitForTiles(page: Page, file: string): Promise<void> {
  try {
    await page.waitForFunction(
      () => {
        const tiles = [...document.querySelectorAll('img.leaflet-tile')];
        return (
          tiles.length > 0 && tiles.every((tile) => tile.classList.contains('leaflet-tile-loaded'))
        );
      },
      undefined,
      { timeout: TILE_TIMEOUT_MS, polling: 250 },
    );
  } catch {
    console.warn(`${file}: some map tiles did not load in time; the picture may have gaps.`);
  }
}

/** Waits for Hanauma Bay's details, opened by `?spot=hanauma`. */
async function hanaumaDetails(page: Page): Promise<void> {
  await page.getByRole('heading', { level: 2, name: 'Hanauma Bay' }).waitFor({ state: 'visible' });
}

/**
 * Opens the point readout in Hanauma Bay, so the picture shows the depth there. Selecting the spot
 * moves the map to it; back on the ranking, the pins are hidden for a moment so the tap reaches
 * the map under Hanauma Bay's pin instead of the pin. Depth lookups are answered with NOAA's
 * recording for a point in the bay, so the readout's depth is the bay's.
 */
async function inspectHanaumaBay(page: Page): Promise<void> {
  await hanaumaDetails(page);
  const pin = page.locator('glassy-map').getByRole('button', { name: /^Hanauma Bay/ });
  const box = await pin.boundingBox();
  if (!box) throw new Error("Hanauma Bay's pin is not on screen");
  await page.getByRole('button', { name: 'Back to list' }).click();
  const spotsToggle = menuButton(page, 'Spots');
  await spotsToggle.click();
  await page.mouse.click(box.x + PIN_DOT_OFFSET, box.y + PIN_DOT_OFFSET);
  await page.locator('.leaflet-popup glassy-point-readout').waitFor({ state: 'visible' });
  await spotsToggle.click();
  await waitForForecast(page);
}

function menuButton(page: Page, name: string) {
  return page
    .getByRole('navigation', { name: 'Map controls' })
    .getByRole('button', { name, exact: true });
}

/** Serves `dist/` with the same static server the end-to-end tests use in CI. */
async function startServer(): Promise<ChildProcess> {
  const server = spawn(process.execPath, ['e2e/support/serve-build.mts', String(PORT)], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let attempt = 0; attempt < 50; attempt++) {
    if (server.exitCode !== null) {
      throw new Error('The static server stopped. Run `npm run build` first.');
    }
    try {
      if ((await fetch(BASE_URL)).ok) return server;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  server.kill();
  throw new Error(`The static server did not start on port ${PORT}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
