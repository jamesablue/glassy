import {
  catalogFingerprint,
  encodeSeries,
  GRID_VARIABLES,
  OPEN_METEO_SOURCE,
  SNAPSHOT_FORMAT_VERSION,
  SPOT_VARIABLES,
  type ForecastSnapshot,
  type GridSpec,
  type EncodedSeries,
  type GridVariable,
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

/**
 * Where a series comes from, and the decimal places to keep: as many as Open-Meteo sends, so the
 * snapshot holds exactly the values the API returned (checked against the recorded responses).
 */
interface SeriesSource<R extends ResponseId, V extends string> {
  readonly response: R;
  readonly variable: V;
  readonly decimals: number;
}

function from<R extends ResponseId>(response: R) {
  return <V extends string>(variable: V, decimals: number): SeriesSource<R, V> => ({
    response,
    variable,
    decimals,
  });
}

const spotMarine = from('spotMarine')<SpotMarineVariable>;
const spotWeather = from('spotWeather')<SpotWeatherVariable>;
const gridMarine = from('gridMarine')<GridMarineVariable>;
const gridWind = from('gridWind')<GridWindVariable>;

/** The Open-Meteo variable behind each spot series. */
const SPOT_SOURCES: Readonly<
  Record<
    SpotVariable,
    | SeriesSource<'spotMarine', SpotMarineVariable>
    | SeriesSource<'spotWeather', SpotWeatherVariable>
  >
> = {
  swellHeight: spotMarine('swell_wave_height', 2),
  swellPeriod: spotMarine('swell_wave_period', 2),
  swellDirection: spotMarine('swell_wave_direction', 0),
  secondarySwellHeight: spotMarine('secondary_swell_wave_height', 2),
  secondarySwellPeriod: spotMarine('secondary_swell_wave_period', 2),
  secondarySwellDirection: spotMarine('secondary_swell_wave_direction', 0),
  windWaveHeight: spotMarine('wind_wave_height', 2),
  windWavePeriod: spotMarine('wind_wave_period', 2),
  windWaveDirection: spotMarine('wind_wave_direction', 0),
  seaSurfaceTemperature: spotMarine('sea_surface_temperature', 1),
  currentSpeed: spotMarine('ocean_current_velocity', 1),
  currentDirection: spotMarine('ocean_current_direction', 0),
  seaLevel: spotMarine('sea_level_height_msl', 2),
  windSpeed: spotWeather('wind_speed_10m', 2),
  windDirection: spotWeather('wind_direction_10m', 0),
  windGust: spotWeather('wind_gusts_10m', 1),
  rainChance: spotWeather('precipitation_probability', 0),
  isDay: spotWeather('is_day', 0),
};

/** The Open-Meteo variable behind each grid field. */
const GRID_SOURCES: Readonly<
  Record<
    GridVariable,
    SeriesSource<'gridMarine', GridMarineVariable> | SeriesSource<'gridWind', GridWindVariable>
  >
> = {
  waveHeight: gridMarine('wave_height', 2),
  waveDirection: gridMarine('wave_direction', 0),
  wavePeriod: gridMarine('wave_period', 2),
  swellHeight: gridMarine('swell_wave_height', 2),
  swellDirection: gridMarine('swell_wave_direction', 0),
  swellPeriod: gridMarine('swell_wave_period', 2),
  windSpeed: gridWind('wind_speed_10m', 2),
  windDirection: gridWind('wind_direction_10m', 0),
};

/**
 * Combines the four Open-Meteo responses into one snapshot, in the domain's variable names, on the
 * hours all four share, each series encoded with `encodeSeries`. Values Open-Meteo has no data for,
 * and variables it left out, become `null`.
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
  const pack = (source: SeriesSource<ResponseId, string>): EncodedSeries => {
    const series = locations[source.response];
    return encodeSeries(packHourly(series, source.variable, hours), series.length, source.decimals);
  };

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
): (number | null)[] {
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
