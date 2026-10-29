import type { HeightUnit } from '../models';
import { FEET_PER_METER } from './conversions';

export const FLAT = 'Flat';

/** Below these heights the surf reads as flat. */
const FLAT_BELOW_FEET = 0.4;
const FLAT_BELOW_METERS = 0.12;

/** Big surf, and metres, span 80% to 120% of the estimate. */
const RANGE_LOW = 0.8;
const RANGE_HIGH = 1.2;

/** From these heights (ft) the range widens from 1 ft to 2 ft, then to 80–120%. */
const TWO_FOOT_FROM = 4;
const PROPORTIONAL_FROM = 12;

/**
 * A surf-report range in whole feet for an estimate in feet, or `undefined` when it reads as flat.
 * The widths follow Oahu's lifeguard reports, which quote small surf in 1 ft ranges ("1–2", "2–3")
 * and bigger surf in 2 ft ranges ("4–6", "6–8"):
 *
 * - under 1 ft: 0–1
 * - 1 to 4 ft: 1 ft wide, from the estimate rounded down (2.31 ft reads 2–3)
 * - 4 to 12 ft: 2 ft wide, centered on the estimate (5.7 ft reads 5–7)
 * - 12 ft and up: 80% to 120% of the estimate
 *
 * The range always contains the estimate.
 */
export function feetRange(feet: number): readonly [low: number, high: number] | undefined {
  if (feet < FLAT_BELOW_FEET) return undefined;
  if (feet < 1) return [0, 1];
  if (feet < TWO_FOOT_FROM) return [Math.floor(feet), Math.floor(feet) + 1];
  if (feet < PROPORTIONAL_FROM) return [Math.round(feet) - 1, Math.round(feet) + 1];
  return [Math.floor(feet * RANGE_LOW), Math.ceil(feet * RANGE_HIGH)];
}

/**
 * A surf-report style height range without the unit, for example "2–3" or "0.5–0.8", or "Flat".
 * Feet follow {@link feetRange}; metres keep one decimal.
 */
export function surfRange(meters: number, unit: HeightUnit): string {
  if (unit === 'ft') {
    const range = feetRange(meters * FEET_PER_METER);
    return range ? `${range[0]}–${range[1]}` : FLAT;
  }
  if (meters < FLAT_BELOW_METERS) return FLAT;
  return `${(meters * RANGE_LOW).toFixed(1)}–${(meters * RANGE_HIGH).toFixed(1)}`;
}

/** {@link surfRange} with the unit, for example "2–3 ft". Flat stays "Flat". */
export function surfText(meters: number, unit: HeightUnit): string {
  const range = surfRange(meters, unit);
  return range === FLAT ? FLAT : `${range} ${unit}`;
}
