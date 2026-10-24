import {
  catalogFingerprint,
  GRID_VARIABLES,
  OPEN_METEO_SOURCE,
  SNAPSHOT_FORMAT_VERSION,
  SPOT_VARIABLES,
  type ForecastSnapshot,
  type GridSpec,
  type GridVariable,
  type SnapshotSeries,
  type Spot,
  type SpotVariable,
} from '@glassy/shared';
import type {
  OpenMeteoForecastResponses,
  OpenMeteoLocation,
  OpenMeteoResponse,
} from '../open-meteo/types';
import type {
  GridMarineVariable,
  GridWindVariable,
  SpotMarineVariable,
  SpotWeatherVariable,
} from '../open-meteo/urls';

/** What a snapshot is made for. */
export interface SnapshotTarget {
  /** The catalog the spot requests were made for, in catalog order. */
  readonly spots: readonly Spot[];
  /** The grid the grid requests were made for, in field order. */
  readonly grid: GridSpec;
  /** When the responses were fetched. */
  readonly fetchedAt: Date;
}

/** A run of consecutive hours on a time axis. */
export interface HourRange {
  /** The first hour, Unix seconds. */
  readonly start: number;
  readonly hourCount: number;
}

type ResponseId = keyof OpenMeteoForecastResponses;

/** The Open-Meteo variable behind each spot series. */
const SPOT_SOURCES: Readonly<
  Record<
    SpotVariable,
    | { readonly response: 'spotMarine'; readonly variable: SpotMarineVariable }
    | { readonly response: 'spotWeather'; readonly variable: SpotWeatherVariable }
  >
> = {
  swellHeight: { response: 'spotMarine', variable: 'swell_wave_height' },
  swellPeriod: { response: 'spotMarine', variable: 'swell_wave_period' },
  swellDirection: { response: 'spotMarine', variable: 'swell_wave_direction' },
  secondarySwellHeight: { response: 'spotMarine', variable: 'secondary_swell_wave_height' },
  secondarySwellPeriod: { response: 'spotMarine', variable: 'secondary_swell_wave_period' },
  secondarySwellDirection: { response: 'spotMarine', variable: 'secondary_swell_wave_direction' },
  windWaveHeight: { response: 'spotMarine', variable: 'wind_wave_height' },
  windWavePeriod: { response: 'spotMarine', variable: 'wind_wave_period' },
  windWaveDirection: { response: 'spotMarine', variable: 'wind_wave_direction' },
  seaSurfaceTemperature: { response: 'spotMarine', variable: 'sea_surface_temperature' },
  currentSpeed: { response: 'spotMarine', variable: 'ocean_current_velocity' },
  currentDirection: { response: 'spotMarine', variable: 'ocean_current_direction' },
  seaLevel: { response: 'spotMarine', variable: 'sea_level_height_msl' },
  windSpeed: { response: 'spotWeather', variable: 'wind_speed_10m' },
  windDirection: { response: 'spotWeather', variable: 'wind_direction_10m' },
  windGust: { response: 'spotWeather', variable: 'wind_gusts_10m' },
  rainChance: { response: 'spotWeather', variable: 'precipitation_probability' },
  isDay: { response: 'spotWeather', variable: 'is_day' },
};

/** The Open-Meteo variable behind each grid field. */
const GRID_SOURCES: Readonly<
  Record<
    GridVariable,
    | { readonly response: 'gridMarine'; readonly variable: GridMarineVariable }
    | { readonly response: 'gridWind'; readonly variable: GridWindVariable }
  >
> = {
  waveHeight: { response: 'gridMarine', variable: 'wave_height' },
  waveDirection: { response: 'gridMarine', variable: 'wave_direction' },
  wavePeriod: { response: 'gridMarine', variable: 'wave_period' },
  swellHeight: { response: 'gridMarine', variable: 'swell_wave_height' },
  swellDirection: { response: 'gridMarine', variable: 'swell_wave_direction' },
  swellPeriod: { response: 'gridMarine', variable: 'swell_wave_period' },
  windSpeed: { response: 'gridWind', variable: 'wind_speed_10m' },
  windDirection: { response: 'gridWind', variable: 'wind_direction_10m' },
};

/**
 * Combines the four Open-Meteo responses into one snapshot, in the domain's variable names, on the
 * hours all four share. Values Open-Meteo has no data for, and variables it left out, become `null`.
 *
 * @throws Error when the responses do not line up with the grid, the catalog or each other
 */
export function buildSnapshot(
  responses: OpenMeteoForecastResponses,
  target: SnapshotTarget,
): ForecastSnapshot {
  const cellCount = target.grid.rows * target.grid.cols;
  const locations: Readonly<Record<ResponseId, readonly OpenMeteoLocation<string>[]>> = {
    gridMarine: expectLocations(responses.gridMarine, cellCount, 'grid marine'),
    gridWind: expectLocations(responses.gridWind, cellCount, 'grid wind'),
    spotMarine: expectLocations(responses.spotMarine, target.spots.length, 'spot marine'),
    spotWeather: expectLocations(responses.spotWeather, target.spots.length, 'spot weather'),
  };
  const hours = sharedHours(Object.values(locations).map((list) => list[0]?.hourly.time ?? []));
  const pack = (source: { response: ResponseId; variable: string }): SnapshotSeries =>
    packHourly(locations[source.response], source.variable, hours);

  return {
    formatVersion: SNAPSHOT_FORMAT_VERSION,
    fetchedAt: target.fetchedAt.toISOString(),
    source: OPEN_METEO_SOURCE,
    catalogFingerprint: catalogFingerprint(target.spots),
    times: Array.from({ length: hours.hourCount }, (_, hour) => hours.start + hour * 3600),
    spots: {
      ids: target.spots.map((spot) => spot.id),
      series: recordFrom(SPOT_VARIABLES, (name) => pack(SPOT_SOURCES[name])),
    },
    grid: {
      spec: target.grid,
      fields: recordFrom(GRID_VARIABLES, (name) => pack(GRID_SOURCES[name])),
    },
  };
}

/**
 * The hours every time axis shares: from the latest first hour to the earliest last one. The
 * marine and weather models are separate services and their axes can start or end an hour apart.
 *
 * @throws Error when an axis is empty or does not contain the shared first hour
 */
export function sharedHours(axes: readonly (readonly number[])[]): HourRange {
  const start = Math.max(...axes.map((axis) => axis[0] ?? NaN));
  if (!Number.isFinite(start) || !axes.every((axis) => axis.includes(start))) {
    throw new Error('The forecast responses have no hours in common');
  }
  return { start, hourCount: Math.min(...axes.map((axis) => axis.length - axis.indexOf(start))) };
}

/**
 * One variable at every location, cut to `hours`, hour-major: index = `hour * locations +
 * location`. A variable a location does not have, and Open-Meteo's `null`s, become `null`.
 */
function packHourly(
  locations: readonly OpenMeteoLocation<string>[],
  variable: string,
  hours: HourRange,
): SnapshotSeries {
  const offset = locations[0]?.hourly.time.indexOf(hours.start) ?? 0;
  const values: (number | null)[] = [];
  for (let hour = 0; hour < hours.hourCount; hour++) {
    for (const location of locations) {
      const value = location.hourly[variable]?.[offset + hour];
      values.push(typeof value === 'number' && Number.isFinite(value) ? value : null);
    }
  }
  return values;
}

/**
 * A response's locations, checked against the number requested. Open-Meteo sends a bare object
 * when only one location was requested, and every location of a response shares its time axis.
 */
function expectLocations<V extends string>(
  response: OpenMeteoResponse<V>,
  expected: number,
  label: string,
): readonly OpenMeteoLocation<string>[] {
  const locations: readonly OpenMeteoLocation<string>[] = Array.isArray(response)
    ? response
    : [response];
  if (locations.length !== expected) {
    throw new Error(
      `The ${label} response has ${locations.length} locations instead of ${expected}`,
    );
  }
  const axis = locations[0]?.hourly.time.join();
  if (locations.some((location) => location.hourly.time.join() !== axis)) {
    throw new Error(`The ${label} response has locations on different hours`);
  }
  return locations;
}

/** A record with one entry per key. `Object.fromEntries` loses the key type, hence the cast. */
function recordFrom<K extends string, T>(keys: readonly K[], valueOf: (key: K) => T): Record<K, T> {
  return Object.fromEntries(keys.map((key) => [key, valueOf(key)])) as Record<K, T>;
}
