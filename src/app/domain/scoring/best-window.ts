import { valueAt } from '../math/value-at';

/** Length of the suggested snorkel session, hours. */
export const BEST_WINDOW_HOURS = 3;

/**
 * How much better (in score points) a later window must be to replace an earlier one. Without it,
 * rounding noise would push the suggestion days ahead for a gain nobody could feel.
 */
export const BEST_WINDOW_MIN_GAIN = 0.05;

export interface BestWindow {
  /** Index of the window's first hour. */
  readonly start: number;
  /** Mean score across the window. */
  readonly average: number;
}

/**
 * The best daylight session of {@link BEST_WINDOW_HOURS} hours starting at or after `fromHour`,
 * or `null` when no full window fits in daylight. A window counts as daylight when its first and
 * last hours are, which holds for any window shorter than a night. Earlier windows win ties.
 *
 * @param scores one spot's score for each forecast hour
 * @param isDay daylight flag for each forecast hour
 */
export function bestWindow(
  scores: ArrayLike<number>,
  isDay: readonly boolean[],
  fromHour: number,
): BestWindow | null {
  let best: BestWindow | null = null;
  const last = BEST_WINDOW_HOURS - 1;
  for (let start = fromHour; start + last < scores.length; start++) {
    if (!isDay[start] || !isDay[start + last]) continue;
    let sum = 0;
    for (let hour = start; hour <= start + last; hour++) sum += valueAt(scores, hour);
    const average = sum / BEST_WINDOW_HOURS;
    if (!best || average > best.average + BEST_WINDOW_MIN_GAIN) best = { start, average };
  }
  return best;
}
