import type { Palette, Rgb } from '../models';
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
