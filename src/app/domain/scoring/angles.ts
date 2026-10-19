/**
 * Smallest angle between two compass bearings, in degrees from 0 to 180. Works for any inputs,
 * including negatives and values past 360, so 350° and 10° are 20° apart.
 */
export function angularDifference(a: number, b: number): number {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}
