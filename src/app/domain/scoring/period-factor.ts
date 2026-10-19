import { clamp } from '../math/clamp';

/** Period (seconds) assumed when the model gives a height and direction but no period. */
export const DEFAULT_WAVE_PERIOD = 8;

/**
 * How much bigger than its offshore height a wave train breaks, given its period in seconds.
 *
 * Long-period swell carries more energy per metre of height and steepens more as it shoals onto
 * the reef, so a 15 s swell breaks far bigger than 6 s wind chop of the same offshore height.
 * The factor grows linearly with period and is held between 0.8 (short chop) and 1.7 (long
 * groundswell).
 */
export function periodFactor(period: number): number {
  const seconds = Number.isFinite(period) ? period : DEFAULT_WAVE_PERIOD;
  return clamp(0.5 + 0.065 * seconds, 0.8, 1.7);
}
