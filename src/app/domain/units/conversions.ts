import type { HeightUnit, SpeedUnit } from '../models';

export const FEET_PER_METER = 3.28084;
export const KNOTS_PER_METER_PER_SECOND = 1.943844;
export const KMH_PER_KNOT = 1.852;

/** Multiply a height in metres by this to get the display unit. */
export const HEIGHT_FACTORS: Readonly<Record<HeightUnit, number>> = {
  ft: FEET_PER_METER,
  m: 1,
};

/** Multiply a speed in m/s by this to get the display unit. */
export const SPEED_FACTORS: Readonly<Record<SpeedUnit, number>> = {
  kt: KNOTS_PER_METER_PER_SECOND,
  mph: 2.236936,
  kmh: 3.6,
  ms: 1,
};

export const SPEED_LABELS: Readonly<Record<SpeedUnit, string>> = {
  kt: 'kt',
  mph: 'mph',
  kmh: 'km/h',
  ms: 'm/s',
};

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}
