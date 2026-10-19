/** A point on a piecewise-linear curve. */
export type Knot = readonly [x: number, y: number];

/** Knots sorted by ascending `x`. */
export type PiecewiseTable = readonly [Knot, ...Knot[]];

/**
 * Linear interpolation through a table of knots. Below the first knot (and for `NaN`) it returns
 * the first `y`; above the last knot it holds the last `y`.
 */
export function piecewise(table: PiecewiseTable, x: number): number {
  let [x0, y0] = table[0];
  if (!(x > x0)) return y0;
  for (const [x1, y1] of table) {
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    x0 = x1;
    y0 = y1;
  }
  return y0;
}
