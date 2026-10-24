/** The forecast variables a snapshot carries, in the domain's own names and units. */

/** Hourly forecast variables recorded for each spot. Units match the app's `SpotHourSample`. */
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

/**
 * Hourly variables recorded for each grid cell: combined sea for the waves layer, primary swell for
 * swell and period, and wind. Heights in meters, periods in seconds, wind speed in m/s, directions
 * in compass degrees the wind or waves come from.
 */
export const GRID_VARIABLES = [
  'waveHeight',
  'waveDirection',
  'wavePeriod',
  'swellHeight',
  'swellDirection',
  'swellPeriod',
  'windSpeed',
  'windDirection',
] as const;

export type GridVariable = (typeof GRID_VARIABLES)[number];
