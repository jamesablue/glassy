import type { PiecewiseTable } from './piecewise';

/**
 * Score points lost to surf at the spot, by breaking height in feet. Knee-high surf barely
 * matters; by head-high (6 ft) getting in and out over the reef is no longer safe.
 */
export const SURF_PENALTY: PiecewiseTable = [
  [0, 0],
  [0.5, 0.2],
  [1, 0.8],
  [2, 2.5],
  [3, 4.5],
  [4, 6.5],
  [5, 8],
  [6, 9.5],
  [8, 10],
];

/**
 * Score points lost to wind, by effective (onshore-weighted, sheltered) wind in knots. Light
 * breezes are harmless; trade-wind strength chops up the surface and stirs up sediment.
 */
export const WIND_PENALTY: PiecewiseTable = [
  [0, 0],
  [6, 0.3],
  [10, 1.2],
  [15, 2.6],
  [20, 4.2],
  [25, 5.8],
  [35, 8],
];

/** Score points lost to surface current, in knots. Half a knot is easy to swim against. */
export const CURRENT_PENALTY: PiecewiseTable = [
  [0, 0],
  [0.5, 0],
  [1, 0.6],
  [2, 2],
];
