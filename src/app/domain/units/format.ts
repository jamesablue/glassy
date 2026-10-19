import type { HeightUnit, SpeedUnit, TemperatureUnit } from '../models';
import { celsiusToFahrenheit, FEET_PER_METER, HEIGHT_FACTORS, SPEED_FACTORS } from './conversions';

/** Shown in place of a value the forecast has no data for. */
export const NO_VALUE = '—';

/**
 * A height in the chosen unit, without the unit: one decimal below 10 ("3.4"), whole numbers from
 * 10 up ("12"), where a decimal would be false precision.
 */
export function formatHeight(meters: number, unit: HeightUnit): string {
  const value = meters * HEIGHT_FACTORS[unit];
  return value >= 10 ? String(Math.round(value)) : value.toFixed(1);
}

/** A height with its sign, for sea level above or below the mean: "+0.8", "-1.2". */
export function formatSignedHeight(meters: number, unit: HeightUnit): string {
  const text = formatHeight(meters, unit);
  return meters >= 0 ? `+${text}` : text;
}

/** A wave period in whole seconds, without the unit. */
export function formatPeriod(seconds: number): string {
  return String(Math.round(seconds));
}

/** A speed in the chosen unit as a whole number, without the unit. */
export function formatSpeed(metersPerSecond: number, unit: SpeedUnit): string {
  return String(Math.round(metersPerSecond * SPEED_FACTORS[unit]));
}

/** A temperature with its unit: whole degrees Fahrenheit ("79°F") or Celsius to one decimal. */
export function formatTemperature(celsius: number, unit: TemperatureUnit): string {
  return unit === 'f' ? `${Math.round(celsiusToFahrenheit(celsius))}°F` : `${celsius.toFixed(1)}°C`;
}

/**
 * A water depth with its unit, following the height unit: whole feet ("33 ft"), or metres with
 * one decimal below 10 m ("4.5 m") and whole metres from there.
 */
export function formatDepth(meters: number, unit: HeightUnit): string {
  if (unit === 'ft') return `${Math.round(meters * FEET_PER_METER)} ft`;
  return meters < 10 ? `${meters.toFixed(1)} m` : `${Math.round(meters)} m`;
}
