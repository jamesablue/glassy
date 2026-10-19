export const COMPASS_POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

export type CompassPoint = (typeof COMPASS_POINTS)[number];

const DEGREES_PER_POINT = 360 / COMPASS_POINTS.length;

/**
 * The nearest of the 16 compass points to a bearing, for example 100° → "E". Each point covers
 * 22.5°, centred on its bearing, so 11.25° already rounds up to "NNE". Any bearing works,
 * including negatives and values past 360. `undefined` when the bearing is not a number.
 */
export function compassPoint(degrees: number): CompassPoint | undefined {
  const normalized = ((degrees % 360) + 360) % 360;
  return COMPASS_POINTS[Math.round(normalized / DEGREES_PER_POINT) % COMPASS_POINTS.length];
}
