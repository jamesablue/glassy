import { valueAt } from '../math/value-at';
import type { GridSpec } from '../models';

/**
 * Bilinear interpolation of a gridded field at a fractional position (see `gridPosition`).
 * Positions on the top row or right column reuse the last full cell, so the edge values come out
 * exactly. Any `NaN` corner makes the result `NaN`.
 *
 * @param values the field, `rows * cols` values per hour
 */
export function bilinear(
  grid: GridSpec,
  values: ArrayLike<number>,
  hour: number,
  row: number,
  col: number,
): number {
  const { rows, cols } = grid;
  const row0 = Math.min(Math.trunc(row), rows - 2);
  const col0 = Math.min(Math.trunc(col), cols - 2);
  const rowWeight = row - row0;
  const colWeight = col - col0;
  const base = hour * rows * cols + row0 * cols + col0;

  const south = valueAt(values, base) * (1 - colWeight) + valueAt(values, base + 1) * colWeight;
  const north =
    valueAt(values, base + cols) * (1 - colWeight) + valueAt(values, base + cols + 1) * colWeight;
  return south * (1 - rowWeight) + north * rowWeight;
}
