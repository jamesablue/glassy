import type { Ink, Palette, Rgb } from '../models';
import { colorAt } from './palettes';

/** Entries in a palette lookup table. */
export const LUT_SIZE = 512;

/**
 * Samples a palette into a flat RGB lookup table (`size * 3` bytes) spanning 0 to `palette.max`.
 * The field renderer colours each pixel with one table read instead of searching the stops.
 */
export function buildLut(palette: Palette, size = LUT_SIZE): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(size * 3);
  for (let i = 0; i < size; i++) {
    lut.set(colorAt(palette, (i / (size - 1)) * palette.max), i * 3);
  }
  return lut;
}

/** The colour as a CSS `rgb()` value. */
export function cssRgb(color: Rgb): string {
  return `rgb(${color[0]},${color[1]},${color[2]})`;
}

/** Perceived brightness (0–255) above which dark text reads better than white. */
const DARK_INK_THRESHOLD = 165;

/**
 * The text colour that stays readable on a background, using the Rec. 601 luma weights: green
 * looks far brighter to the eye than red, and blue the dimmest.
 */
export function inkFor(background: Rgb): Ink {
  const luma = 0.299 * background[0] + 0.587 * background[1] + 0.114 * background[2];
  return luma > DARK_INK_THRESHOLD ? 'dark' : 'light';
}
