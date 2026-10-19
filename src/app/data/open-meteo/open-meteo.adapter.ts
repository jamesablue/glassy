import { toVectorField } from '../../domain/grid';
import { valueAt } from '../../domain/math';
import {
  SPOT_VARIABLES,
  type ForecastBundle,
  type GridForecast,
  type GridSpec,
  type SpotForecast,
  type SpotVariable,
} from '../../domain/models';
import type {
  OpenMeteoForecastResponses,
  OpenMeteoLocation,
  OpenMeteoResponse,
} from './open-meteo.types';
import {
  GRID_MARINE_VARS,
  GRID_WIND_VARS,
  SPOT_MARINE_VARS,
  SPOT_WEATHER_VARS,
  type GridMarineVariable,
  type GridWindVariable,
  type SpotMarineVariable,
  type SpotWeatherVariable,
} from './open-meteo.urls';

/** A run of consecutive hours on a time axis. */
export interface HourRange {
  /** The first hour, Unix seconds. */
  readonly start: number;
  readonly hourCount: number;
}

/**
 * One response packed into flat typed arrays. `Float32Array`s keep a five-day forecast for the
 * whole grid compact, interpolate fast in the render loop and survive IndexedDB's structured clone
 * as they are, with no JSON round trip.
 */
export interface PackedSeries<V extends string> {
  /** Start of each hour, Unix seconds. */
  readonly times: readonly number[];
  readonly locationCount: number;
  /** `locationCount` values per hour: index = `hour * locationCount + location`, `NaN` if missing. */
  readonly values: Readonly<Record<V, Float32Array>>;
}

/**
 * The hours every time axis shares: from the latest first hour to the earliest last one. The
 * marine and weather models are separate services and their axes can start or end an hour apart,
 * so all four datasets are cut to this range before they are combined.
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
 * Packs a response's hourly series into {@link PackedSeries}, optionally cut to `hours`.
 * Accepts the bare object Open-Meteo sends for a single location as well as an array. Variables a
 * location does not have, and `null` values, become `NaN`.
 *
 * @throws Error when the response has no locations
 * @throws RangeError when `hours` is not on the response's time axis
 */
export function packHourly<V extends string>(
  response: OpenMeteoResponse<V>,
  variables: readonly V[],
  hours?: HourRange,
): PackedSeries<V> {
  const locations = toLocationList(response);
  const axis = locations[0]?.hourly.time;
  if (!axis) throw new Error('The forecast response has no locations');

  const offset = hours ? axis.indexOf(hours.start) : 0;
  const hourCount = hours?.hourCount ?? axis.length;
  if (offset < 0 || offset + hourCount > axis.length) {
    throw new RangeError('The requested hours are not in the forecast response');
  }

  const locationCount = locations.length;
  const values = recordFrom(variables, (variable) => {
    const packed = new Float32Array(hourCount * locationCount).fill(NaN);
    locations.forEach((location, index) => {
      const series = location.hourly[variable];
      if (!series) return;
      for (let hour = 0; hour < hourCount; hour++) {
        packed[hour * locationCount + index] = series[offset + hour] ?? NaN;
      }
    });
    return packed;
  });

  return { times: axis.slice(offset, offset + hourCount), locationCount, values };
}

/**
 * Combines the four forecast responses into the domain's {@link ForecastBundle}: every dataset on
 * the hours they share, grid fields and particle vectors for the map, per-spot series for the
 * scoring model, and an island-wide daylight flag.
 *
 * @param grid the grid the grid requests were made for, in field order
 * @param spotCount the number of spots the spot requests were made for, in catalog order
 * @throws Error when the responses do not line up with the grid, the catalog or each other
 */
export function toForecastBundle(
  responses: OpenMeteoForecastResponses,
  grid: GridSpec,
  spotCount: number,
): ForecastBundle {
  const hours = sharedHours([
    timeAxis(responses.gridMarine),
    timeAxis(responses.gridWind),
    timeAxis(responses.spotMarine),
    timeAxis(responses.spotWeather),
  ]);
  const cellCount = grid.rows * grid.cols;
  const gridMarine = expectLocations(
    packHourly(responses.gridMarine, GRID_MARINE_VARS, hours),
    cellCount,
    'grid marine',
  );
  const gridWind = expectLocations(
    packHourly(responses.gridWind, GRID_WIND_VARS, hours),
    cellCount,
    'grid wind',
  );
  const spotMarine = expectLocations(
    packHourly(responses.spotMarine, SPOT_MARINE_VARS, hours),
    spotCount,
    'spot marine',
  );
  const spotWeather = expectLocations(
    packHourly(responses.spotWeather, SPOT_WEATHER_VARS, hours),
    spotCount,
    'spot weather',
  );

  return {
    times: gridMarine.times,
    isDay: islandDaylight(spotWeather),
    grid: toGridForecast(grid, gridMarine, gridWind),
    spots: toSpotForecast(spotMarine, spotWeather),
  };
}

type SpotSeriesSource =
  | { readonly dataset: 'marine'; readonly variable: SpotMarineVariable }
  | { readonly dataset: 'weather'; readonly variable: SpotWeatherVariable };

/** The Open-Meteo variable behind each spot series. */
const SPOT_SERIES_SOURCES: Readonly<Record<SpotVariable, SpotSeriesSource>> = {
  swellHeight: { dataset: 'marine', variable: 'swell_wave_height' },
  swellPeriod: { dataset: 'marine', variable: 'swell_wave_period' },
  swellDirection: { dataset: 'marine', variable: 'swell_wave_direction' },
  secondarySwellHeight: { dataset: 'marine', variable: 'secondary_swell_wave_height' },
  secondarySwellPeriod: { dataset: 'marine', variable: 'secondary_swell_wave_period' },
  secondarySwellDirection: { dataset: 'marine', variable: 'secondary_swell_wave_direction' },
  windWaveHeight: { dataset: 'marine', variable: 'wind_wave_height' },
  windWavePeriod: { dataset: 'marine', variable: 'wind_wave_period' },
  windWaveDirection: { dataset: 'marine', variable: 'wind_wave_direction' },
  seaSurfaceTemperature: { dataset: 'marine', variable: 'sea_surface_temperature' },
  currentSpeed: { dataset: 'marine', variable: 'ocean_current_velocity' },
  currentDirection: { dataset: 'marine', variable: 'ocean_current_direction' },
  seaLevel: { dataset: 'marine', variable: 'sea_level_height_msl' },
  windSpeed: { dataset: 'weather', variable: 'wind_speed_10m' },
  windDirection: { dataset: 'weather', variable: 'wind_direction_10m' },
  windGust: { dataset: 'weather', variable: 'wind_gusts_10m' },
  rainChance: { dataset: 'weather', variable: 'precipitation_probability' },
  isDay: { dataset: 'weather', variable: 'is_day' },
};

function toGridForecast(
  spec: GridSpec,
  marine: PackedSeries<GridMarineVariable>,
  wind: PackedSeries<GridWindVariable>,
): GridForecast {
  const sea = marine.values;
  const air = wind.values;
  return {
    spec,
    fields: {
      windSpeed: air.wind_speed_10m,
      waveHeight: sea.wave_height,
      wavePeriod: sea.wave_period,
      swellHeight: sea.swell_wave_height,
      swellPeriod: sea.swell_wave_period,
    },
    vectors: {
      wind: toVectorField(air.wind_speed_10m, air.wind_direction_10m),
      // Wave groups travel at a speed proportional to their period, so the period sets the pace.
      waves: toVectorField(sea.wave_period, sea.wave_direction),
      swell: toVectorField(sea.swell_wave_period, sea.swell_wave_direction),
    },
  };
}

function toSpotForecast(
  marine: PackedSeries<SpotMarineVariable>,
  weather: PackedSeries<SpotWeatherVariable>,
): SpotForecast {
  return {
    spotCount: marine.locationCount,
    hourCount: marine.times.length,
    series: recordFrom(SPOT_VARIABLES, (name) => {
      const source = SPOT_SERIES_SOURCES[name];
      return source.dataset === 'marine'
        ? marine.values[source.variable]
        : weather.values[source.variable];
    }),
  };
}

/** Daylight per hour, read at the first spot (sunrise varies by a minute or two across Oahu). */
function islandDaylight(weather: PackedSeries<SpotWeatherVariable>): boolean[] {
  return weather.times.map(
    (_, hour) => valueAt(weather.values.is_day, hour * weather.locationCount) > 0.5,
  );
}

function timeAxis<V extends string>(response: OpenMeteoResponse<V>): readonly number[] {
  return toLocationList(response)[0]?.hourly.time ?? [];
}

function toLocationList<V extends string>(
  response: OpenMeteoResponse<V>,
): readonly OpenMeteoLocation<V>[] {
  return isLocationList(response) ? response : [response];
}

function isLocationList<V extends string>(
  response: OpenMeteoResponse<V>,
): response is readonly OpenMeteoLocation<V>[] {
  return Array.isArray(response);
}

function expectLocations<V extends string>(
  series: PackedSeries<V>,
  expected: number,
  label: string,
): PackedSeries<V> {
  if (series.locationCount !== expected) {
    throw new Error(
      `The ${label} response has ${series.locationCount} locations instead of ${expected}`,
    );
  }
  return series;
}

/** A record with one entry per key. `Object.fromEntries` loses the key type, hence the cast. */
function recordFrom<K extends string, T>(keys: readonly K[], valueOf: (key: K) => T): Record<K, T> {
  return Object.fromEntries(keys.map((key) => [key, valueOf(key)])) as Record<K, T>;
}
