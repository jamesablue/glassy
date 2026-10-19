import type { Rgb } from '../models';

/** A band of water depth and the colour it is drawn in. */
export interface DepthBin {
  /** Shallow edge, metres below sea level. */
  readonly min: number;
  /** Deep edge, metres below sea level. */
  readonly max: number;
  readonly color: Rgb;
}

/**
 * Depth classes from the shore out to the abyss. The bins are narrow in the first 12 m, so the
 * depths that matter for snorkelling stand out, and wide beyond.
 */
export const DEPTH_BINS: readonly DepthBin[] = [
  { min: 0, max: 1, color: [205, 246, 228] },
  { min: 1, max: 2, color: [160, 236, 218] },
  { min: 2, max: 3, color: [112, 222, 208] },
  { min: 3, max: 5, color: [68, 203, 203] },
  { min: 5, max: 8, color: [44, 175, 198] },
  { min: 8, max: 12, color: [32, 145, 188] },
  { min: 12, max: 20, color: [27, 115, 172] },
  { min: 20, max: 30, color: [23, 90, 153] },
  { min: 30, max: 50, color: [19, 69, 131] },
  { min: 50, max: 100, color: [15, 51, 108] },
  { min: 100, max: 500, color: [11, 36, 84] },
  { min: 500, max: 12000, color: [6, 20, 56] },
];
