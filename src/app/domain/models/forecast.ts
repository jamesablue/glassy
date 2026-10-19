import type { GridSpec, VectorField } from './grid';

/** Gridded scalar fields drawn as coloured map layers. */
export type ScalarFieldId =
  'windSpeed' | 'waveHeight' | 'wavePeriod' | 'swellHeight' | 'swellPeriod';

/** Gridded vector fields that drive the particle animation. */
export type VectorFieldId = 'wind' | 'waves' | 'swell';

/** Forecast fields on the map grid. */
export interface GridForecast {
  readonly spec: GridSpec;
  /**
   * `rows * cols` values per hour, `NaN` where the model has no data:
   * index = `hour * rows * cols + row * cols + col`.
   * Units: wind speed m/s, heights metres, periods seconds.
   */
  readonly fields: Readonly<Record<ScalarFieldId, Float32Array>>;
  /**
   * Wind vectors are in m/s. Wave and swell vectors use the period (seconds) as magnitude, because
   * wave groups travel at a speed proportional to their period.
   */
  readonly vectors: Readonly<Record<VectorFieldId, VectorField>>;
}

/** The gridded forecast interpolated at one map point and hour. */
export interface PointSample {
  /** m/s */
  readonly windSpeed: number;
  /** Compass direction the wind blows from, degrees. */
  readonly windDirection: number;
  /** Combined sea height, metres. */
  readonly waveHeight: number;
  /** Seconds. */
  readonly wavePeriod: number;
  readonly waveDirection: number;
  /** Primary swell height, metres. */
  readonly swellHeight: number;
  /** Seconds. */
  readonly swellPeriod: number;
  readonly swellDirection: number;
}

/** Hourly forecast variables recorded for each spot. Units match `SpotHourSample`. */
export const SPOT_VARIABLES = [
  'swellHeight',
  'swellPeriod',
  'swellDirection',
  'secondarySwellHeight',
  'secondarySwellPeriod',
  'secondarySwellDirection',
  'windWaveHeight',
  'windWavePeriod',
  'windWaveDirection',
  'seaSurfaceTemperature',
  'currentSpeed',
  'currentDirection',
  'seaLevel',
  'windSpeed',
  'windDirection',
  'windGust',
  'rainChance',
  'isDay',
] as const;

export type SpotVariable = (typeof SPOT_VARIABLES)[number];

/** Forecast values for every spot in a catalog, in catalog order. */
export interface SpotForecast {
  readonly spotCount: number;
  readonly hourCount: number;
  /**
   * `spotCount` values per hour, `NaN` where the model has no data:
   * index = `hour * spotCount + spotIndex`. `isDay` holds 1 for daylight and 0 for night.
   */
  readonly series: Readonly<Record<SpotVariable, Float32Array>>;
}

/** Everything the app draws and scores, aligned to one hourly time axis. */
export interface ForecastBundle {
  /** Start of each forecast hour, Unix seconds. */
  readonly times: readonly number[];
  /**
   * Daylight flag per hour for the whole island. Sunrise differs by only a couple of minutes across
   * Oahu, so the data layer takes it from the first spot.
   */
  readonly isDay: readonly boolean[];
  readonly grid: GridForecast;
  readonly spots: SpotForecast;
}
