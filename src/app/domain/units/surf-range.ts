import type { HeightUnit } from '../models';
import { FEET_PER_METER } from './conversions';

export const FLAT = 'Flat';

/** Below these heights the surf reads as flat. */
const FLAT_BELOW_FEET = 0.4;
const FLAT_BELOW_METERS = 0.12;

/** The range spans 80% to 120% of the estimate, which is how surf reports are usually quoted. */
const RANGE_LOW = 0.8;
const RANGE_HIGH = 1.2;

/**
 * A surf-report range in whole feet for an estimate in feet, or `undefined` when it reads as flat.
 * The range spans about 80% to 120% of the estimate, is at least 1 ft wide and always contains the
 * estimate, so 1.16 ft reads 1–2 rather than 0–1. Anything from flat to 1 ft is 0–1.
 */
export function feetRange(feet: number): readonly [low: number, high: number] | undefined {
  if (feet < FLAT_BELOW_FEET) return undefined;
  if (feet < 1) return [0, 1];
  const low = Math.max(1, Math.floor(feet * RANGE_LOW));
  const high = Math.max(low + 1, Math.round(feet * RANGE_HIGH), Math.ceil(feet));
  return [low, high];
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
