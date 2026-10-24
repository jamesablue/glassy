/**
 * Records every test fixture from one run against the live APIs, so they all describe the same
 * forecast:
 *
 * - `src/testing/fixtures/raw/`: the four Open-Meteo responses exactly as the ingest requests them
 *   (same URLs, built by `forecastRequestUrls` in backend/; until #40 the app requests the same
 *   ones) and three NOAA `identify` responses, plus a manifest with the URLs and recording time. Each Open-Meteo response is cut to the first
 *   48 hours the four share. The data layer's tests read these files and the end-to-end tests
 *   serve them as network mocks.
 * - `src/testing/fixtures/spot-forecast.fixture.json`: the per-spot series in the domain's own
 *   variable names, for the golden scoring test. It is unpacked here independently of the app's
 *   adapter, so the adapter's fixture test compares two implementations.
 *
 * See src/testing/fixtures/README.md for the layout.
 * Usage: `npm run fixtures:record`, then `npm run fixtures:expected` to refresh the expected scores.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { OAHU_SPOTS, type LatLon, type SpotVariable } from '@glassy/shared';
import { DEFAULT_INGEST_SETTINGS } from '../backend/src/ingest/settings';
import type { OpenMeteoLocation, OpenMeteoResponse } from '../backend/src/open-meteo/types';
import { forecastRequestUrls, type ForecastRequestId } from '../backend/src/open-meteo/urls';
import { DEFAULT_GLASSY_CONFIG } from '../src/app/core/glassy-config';
import { identifyUrl } from '../src/app/data/noaa/identify';

const RECORDED_HOURS = 48;
const FIXTURES_DIR = new URL('../src/testing/fixtures/', import.meta.url);
const RAW_DIR = new URL('raw/', FIXTURES_DIR);
const SOURCE = 'Open-Meteo Marine and Forecast APIs (https://open-meteo.com, CC BY 4.0)';
const NOAA_SOURCE =
  'NOAA NCEI DEM mosaic ImageServer (https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_all/ImageServer)';

const OPEN_METEO_FILES: Readonly<Record<ForecastRequestId, string>> = {
  gridMarine: 'open-meteo-grid-marine.json',
  gridWind: 'open-meteo-grid-wind.json',
  spotMarine: 'open-meteo-spot-marine.json',
  spotWeather: 'open-meteo-spot-weather.json',
};
const REQUEST_IDS = Object.keys(OPEN_METEO_FILES) as ForecastRequestId[];

/** One point of each kind the point inspector has to handle. */
const NOAA_POINTS: Readonly<Record<string, LatLon & { readonly description: string }>> = {
  ocean: { lat: 21.269, lon: -157.6936, description: 'Hanauma Bay, a few metres deep' },
  land: { lat: 21.262, lon: -157.8049, description: 'The slope of Diamond Head' },
  nodata: { lat: 0, lon: -180, description: 'The antimeridian, outside the mosaic' },
};

/** Open-Meteo variable behind each spot series in the domain fixture. */
const MARINE_VARIABLES = {
  swellHeight: 'swell_wave_height',
  swellDirection: 'swell_wave_direction',
  swellPeriod: 'swell_wave_period',
  secondarySwellHeight: 'secondary_swell_wave_height',
  secondarySwellDirection: 'secondary_swell_wave_direction',
  secondarySwellPeriod: 'secondary_swell_wave_period',
  windWaveHeight: 'wind_wave_height',
  windWaveDirection: 'wind_wave_direction',
  windWavePeriod: 'wind_wave_period',
  seaSurfaceTemperature: 'sea_surface_temperature',
  currentSpeed: 'ocean_current_velocity',
  currentDirection: 'ocean_current_direction',
  seaLevel: 'sea_level_height_msl',
} as const;
const WEATHER_VARIABLES = {
  windSpeed: 'wind_speed_10m',
  windDirection: 'wind_direction_10m',
  windGust: 'wind_gusts_10m',
  isDay: 'is_day',
  rainChance: 'precipitation_probability',
} as const;
const VARIABLES = { ...MARINE_VARIABLES, ...WEATHER_VARIABLES } satisfies Record<
  SpotVariable,
  string
>;

type Location = OpenMeteoLocation<string>;
type Response = OpenMeteoResponse<string>;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function isLocationList(response: Response): response is readonly Location[] {
  return Array.isArray(response);
}

function locationsOf(response: Response): readonly Location[] {
  return isLocationList(response) ? response : [response];
}

/** Cuts every location's hourly series to `hours` entries from `start`, keeping the response shape. */
function trimHours(response: Response, start: number, hours: number): Response {
  const trim = (location: Location): Location => {
    const offset = location.hourly.time.indexOf(start);
    if (offset < 0 || offset + hours > location.hourly.time.length) {
      throw new Error(`A response has fewer than ${hours} hours from ${start}`);
    }
    const hourly = Object.fromEntries(
      Object.entries(location.hourly).map(([name, values]) => [
        name,
        values?.slice(offset, offset + hours),
      ]),
    );
    return {
      ...location,
      hourly: { ...hourly, time: location.hourly.time.slice(offset, offset + hours) },
    };
  };
  return isLocationList(response) ? response.map(trim) : trim(response);
}

function hourly(location: Location | undefined, name: string): readonly (number | null)[] {
  const values = location?.hourly[name];
  if (!values) throw new Error(`Response has no hourly "${name}"`);
  return values;
}

async function writeJson(
  url: URL,
  value: unknown,
  { pretty }: { pretty: boolean },
): Promise<number> {
  const path = fileURLToPath(url);
  const json = JSON.stringify(value);
  const text = pretty
    ? await format(json, { ...(await resolveConfig(path)), filepath: path })
    : `${json}\n`;
  await writeFile(path, text);
  return Buffer.byteLength(text);
}

async function main(): Promise<void> {
  const urls = forecastRequestUrls(DEFAULT_INGEST_SETTINGS, OAHU_SPOTS);
  const fetched = await Promise.all(
    REQUEST_IDS.map(async (id) => [id, (await fetchJson(urls[id])) as Response] as const),
  );

  // The first hour all four responses share; usually local midnight for every one of them.
  const start = Math.max(
    ...fetched.map(([, response]) => locationsOf(response)[0]?.hourly.time[0] ?? NaN),
  );
  if (!Number.isFinite(start)) throw new Error('A response has no hours');
  const responses = Object.fromEntries(
    fetched.map(([id, response]) => [id, trimHours(response, start, RECORDED_HOURS)]),
  ) as Record<ForecastRequestId, Response>;

  await mkdir(RAW_DIR, { recursive: true });
  const sizes: string[] = [];
  for (const id of REQUEST_IDS) {
    const bytes = await writeJson(new URL(OPEN_METEO_FILES[id], RAW_DIR), responses[id], {
      pretty: false,
    });
    sizes.push(`${OPEN_METEO_FILES[id]} ${(bytes / 1024).toFixed(0)} kB`);
  }

  const noaa: Record<string, { file: string; url: string; description: string }> = {};
  for (const [kind, point] of Object.entries(NOAA_POINTS)) {
    const url = identifyUrl(DEFAULT_GLASSY_CONFIG.noaaDemUrl, point);
    const file = `noaa-identify-${kind}.json`;
    await writeJson(new URL(file, RAW_DIR), await fetchJson(url), { pretty: false });
    noaa[kind] = { file, url, description: point.description };
  }

  const recordedAt = new Date().toISOString();
  await writeJson(
    new URL('manifest.json', RAW_DIR),
    {
      recordedAt,
      hours: RECORDED_HOURS,
      openMeteo: {
        source: SOURCE,
        requests: Object.fromEntries(
          REQUEST_IDS.map((id) => [id, { file: OPEN_METEO_FILES[id], url: urls[id] }]),
        ),
      },
      noaaIdentify: { source: NOAA_SOURCE, requests: noaa },
    },
    { pretty: true },
  );

  // The domain fixture: each spot's series, unpacked straight from the trimmed responses.
  const marine = locationsOf(responses.spotMarine);
  const weather = locationsOf(responses.spotWeather);
  if (marine.length !== OAHU_SPOTS.length || weather.length !== OAHU_SPOTS.length) {
    throw new Error('The spot responses do not have one location per spot');
  }
  const series = Object.fromEntries(
    Object.entries(VARIABLES).map(([variable, name]) => {
      const locations = variable in MARINE_VARIABLES ? marine : weather;
      return [variable, OAHU_SPOTS.map((_, spot) => hourly(locations[spot], name))];
    }),
  );
  await writeJson(
    new URL('spot-forecast.fixture.json', FIXTURES_DIR),
    {
      source: SOURCE,
      recordedAt,
      spotIds: OAHU_SPOTS.map((spot) => spot.id),
      times: hourly(marine[0], 'time'),
      series,
    },
    { pretty: true },
  );

  console.log(`Recorded ${RECORDED_HOURS} hours at ${recordedAt}:\n  ${sizes.join('\n  ')}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
