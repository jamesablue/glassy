/**
 * Records the golden-test fixture: the first 48 hours of real Open-Meteo data for every Oahu spot.
 *
 * It makes the same two spot requests as the app: marine values at each spot's offshore point
 * (`cell_selection=sea`) and weather at the spot itself. The result is saved in the domain's own
 * variable names to src/testing/fixtures/spot-forecast.fixture.json.
 *
 * Usage: `npm run fixtures:record`, then `npm run fixtures:expected` to refresh the expected scores.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { offshorePoint } from '../src/app/domain/geo/offshore-point';
import type { SpotVariable } from '../src/app/domain/models';
import { OAHU_SPOTS } from '../src/app/domain/spots/oahu.spots';
import { HONOLULU_TIME_ZONE } from '../src/app/domain/time/hst';

const MARINE_API = 'https://marine-api.open-meteo.com/v1/marine';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
const FORECAST_DAYS = 5;
const RECORDED_HOURS = 48;
const OUTPUT_PATH = fileURLToPath(
  new URL('../src/testing/fixtures/spot-forecast.fixture.json', import.meta.url),
);

/** Open-Meteo variable behind each spot series. */
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

interface OpenMeteoLocation {
  readonly hourly: Readonly<Record<string, readonly (number | null)[] | undefined>>;
}

/** Same query string the app builds: hourly values, Honolulu time, Unix timestamps. */
function forecastUrl(
  base: string,
  points: readonly { lat: string; lon: string }[],
  variables: readonly string[],
  extra: string,
): string {
  return (
    `${base}?latitude=${points.map((p) => p.lat).join(',')}` +
    `&longitude=${points.map((p) => p.lon).join(',')}` +
    `&hourly=${variables.join(',')}&forecast_days=${FORECAST_DAYS}` +
    `&timezone=${encodeURIComponent(HONOLULU_TIME_ZONE)}&timeformat=unixtime${extra}`
  );
}

async function fetchLocations(url: string): Promise<readonly OpenMeteoLocation[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo returned ${response.status}: ${await response.text()}`);
  }
  const body = (await response.json()) as OpenMeteoLocation | OpenMeteoLocation[];
  return Array.isArray(body) ? body : [body];
}

function hourly(location: OpenMeteoLocation | undefined, name: string): readonly (number | null)[] {
  const values = location?.hourly[name];
  if (!values) throw new Error(`Response has no hourly "${name}"`);
  return values;
}

async function main(): Promise<void> {
  const offshore = OAHU_SPOTS.map((spot) => offshorePoint(spot));
  const [marine, weather] = await Promise.all([
    fetchLocations(
      forecastUrl(
        MARINE_API,
        offshore.map((p) => ({ lat: p.lat.toFixed(4), lon: p.lon.toFixed(4) })),
        Object.values(MARINE_VARIABLES),
        '&cell_selection=sea',
      ),
    ),
    fetchLocations(
      forecastUrl(
        WEATHER_API,
        OAHU_SPOTS.map((spot) => ({ lat: String(spot.lat), lon: String(spot.lon) })),
        Object.values(WEATHER_VARIABLES),
        '&wind_speed_unit=ms&cell_selection=nearest',
      ),
    ),
  ]);

  // Align both models to the marine time axis, as the app does.
  const marineTimes = hourly(marine[0], 'time');
  const weatherOffset = hourly(weather[0], 'time').indexOf(marineTimes[0] ?? NaN);
  if (weatherOffset < 0) throw new Error('Marine and weather time axes do not overlap');

  const recordedHours = (values: readonly (number | null)[], offset: number): (number | null)[] =>
    values.slice(offset, offset + RECORDED_HOURS);

  const series = Object.fromEntries(
    Object.entries(VARIABLES).map(([variable, name]) => {
      const isMarine = variable in MARINE_VARIABLES;
      const locations = isMarine ? marine : weather;
      const offset = isMarine ? 0 : weatherOffset;
      return [
        variable,
        OAHU_SPOTS.map((_, p) => recordedHours(hourly(locations[p], name), offset)),
      ];
    }),
  );

  const fixture = {
    source: 'Open-Meteo Marine and Forecast APIs (https://open-meteo.com, CC BY 4.0)',
    recordedAt: new Date().toISOString(),
    spotIds: OAHU_SPOTS.map((spot) => spot.id),
    times: recordedHours(marineTimes, 0),
    series,
  };

  const options = await resolveConfig(OUTPUT_PATH);
  const text = await format(JSON.stringify(fixture), { ...options, filepath: OUTPUT_PATH });
  await writeFile(OUTPUT_PATH, text);
  console.log(`Wrote ${RECORDED_HOURS} hours for ${OAHU_SPOTS.length} spots to ${OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
