import { bilinear } from '../../domain/grid';
import { clamp, valueAt } from '../../domain/math';
import type { GridSpec } from '../../domain/models';
import type { ViewportLookup } from './viewport-lookup';

/** Opacity of the field inside the grid, out of 255: just short of opaque, so coastlines show. */
export const FIELD_ALPHA = 236;
/** Beyond the grid the field fades to nothing over this many cells, instead of ending in a hard edge. */
export const FIELD_FADE_CELLS = 1.2;

/** One forecast field at one hour, and the colours to paint it in. */
export interface FieldPaint {
  readonly grid: GridSpec;
  /** The field for every hour, laid out like `GridForecast.fields`. */
  readonly values: ArrayLike<number>;
  readonly hour: number;
  /** RGB lookup table spanning 0 to `max` (see `buildLut`). */
  readonly lut: Uint8ClampedArray;
  readonly max: number;
}

/** The parts of `ImageData` the painter writes to, so it runs without a real canvas. */
export interface Pixels {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

/** The LUT entry (0-based) for a value: its share of `max`, rounded and clamped to the table. */
export function lutIndex(value: number, max: number, entries: number): number {
  return clamp(Math.round((value * (entries - 1)) / max), 0, entries - 1);
}

/**
 * Paints a field into RGBA pixels: each pixel interpolates the field at its grid position and takes
 * the colour from the lookup table. Pixels with no data, or too far outside the grid, stay
 * transparent. `pixels` is cleared first, so one buffer can be reused across draws.
 */
export function paintField(pixels: Pixels, lookup: ViewportLookup, field: FieldPaint): void {
  const { data, width, height } = pixels;
  const { grid, values, hour, lut, max } = field;
  const entries = lut.length / 3;
  data.fill(0);

  for (let y = 0; y < height; y++) {
    const row = valueAt(lookup.rows, y);
    const rowOutside = valueAt(lookup.rowsOutside, y);
    for (let x = 0; x < width; x++) {
      const outside = Math.max(rowOutside, valueAt(lookup.colsOutside, x));
      if (!(outside < FIELD_FADE_CELLS)) continue;
      const value = bilinear(grid, values, hour, row, valueAt(lookup.cols, x));
      if (!Number.isFinite(value)) continue;

      const color = lutIndex(value, max, entries) * 3;
      const pixel = (y * width + x) * 4;
      data[pixel] = valueAt(lut, color);
      data[pixel + 1] = valueAt(lut, color + 1);
      data[pixel + 2] = valueAt(lut, color + 2);
      data[pixel + 3] = FIELD_ALPHA * (1 - outside / FIELD_FADE_CELLS);
    }
  }
}
