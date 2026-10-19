import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import manifest from '../../src/testing/fixtures/raw/manifest.json';

const RAW_FIXTURES = join(__dirname, '../../src/testing/fixtures/raw');

/** Esri's basemap and label tiles. */
export const ESRI_TILES = /^https:\/\/server\.arcgisonline\.com\//;
/** Land and depth tiles NOAA renders on request. */
export const NOAA_TILES = /^https:\/\/gis\.ngdc\.noaa\.gov\/.*\/ImageServer\/exportImage\?/;
/** Point elevations from NOAA. */
export const NOAA_IDENTIFY = /^https:\/\/gis\.ngdc\.noaa\.gov\/.*\/ImageServer\/identify\?/;

/** A transparent 1 × 1 PNG: enough for Leaflet to treat a tile as loaded. */
const BLANK_TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const recordings = Object.values(manifest.noaaIdentify.requests).map(({ url, file }) => ({
  url,
  body: readFileSync(join(RAW_FIXTURES, file), 'utf8'),
}));
/** The recording for a point a few metres deep in Hanauma Bay. */
const OCEAN = readFileSync(join(RAW_FIXTURES, manifest.noaaIdentify.requests.ocean.file), 'utf8');

/**
 * Answers the map's tile requests with a blank tile, so end-to-end tests never wait on Esri or
 * NOAA and the screen stays the same from run to run.
 */
export async function serveBlankTiles(page: Page): Promise<void> {
  const blank = { status: 200, contentType: 'image/png', body: BLANK_TILE };
  await page.route(ESRI_TILES, (route) => route.fulfill(blank));
  await page.route(NOAA_TILES, (route) => route.fulfill(blank));
}

/**
 * Answers NOAA point lookups with the recorded responses (`manifest.json`). A tap lands wherever
 * the screen puts it rather than on a recorded point, so any other point gets the Hanauma Bay
 * recording: somewhere at sea with a known depth.
 */
export async function serveRecordedBathymetry(page: Page): Promise<void> {
  await page.route(NOAA_IDENTIFY, (route) => {
    const recorded = recordings.find(({ url }) => url === route.request().url());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: recorded?.body ?? OCEAN,
    });
  });
}
