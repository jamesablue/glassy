/**
 * One wave train from the marine model. Any value is `NaN` when the model has no data for it.
 */
export interface WaveComponent {
  /** Significant wave height offshore, metres. */
  readonly height: number;
  /** Peak period, seconds. */
  readonly period: number;
  /** Compass direction the waves come from, degrees. */
  readonly direction: number;
}

/**
 * Everything the scoring model reads for one spot at one hour, as delivered by the forecast
 * models. Marine values are taken a few kilometres offshore of the spot (see `offshorePoint`),
 * weather values at the spot itself. Missing values are `NaN`.
 */
export interface SpotHourSample {
  readonly primarySwell: WaveComponent;
  readonly secondarySwell: WaveComponent;
  readonly windWaves: WaveComponent;
  /** Wind speed at 10 m, m/s. */
  readonly windSpeed: number;
  /** Compass direction the wind blows from, degrees. */
  readonly windDirection: number;
  /** Wind gusts at 10 m, m/s. */
  readonly windGust: number;
  /** Surface current speed, km/h. */
  readonly currentSpeed: number;
  /** Compass direction the current flows toward, degrees. */
  readonly currentDirection: number;
  /** Sea surface temperature, °C. */
  readonly seaSurfaceTemperature: number;
  /** Sea level relative to mean sea level (tide plus surge), metres. */
  readonly seaLevel: number;
  /** Sea level one hour later, metres. `NaN` for the last forecast hour. */
  readonly seaLevelNextHour: number;
  /** Chance of rain, percent. */
  readonly rainChance: number;
  readonly isDay: boolean;
}
