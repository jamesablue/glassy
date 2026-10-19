import type { GridSpec, LatLon } from '../models';

/**
 * The centre of every grid cell in field order: row by row from the south-west corner, so the
 * `k`-th point is the cell a gridded field stores at index `k` within each hour. Forecasts are
 * requested for these points in this order, which makes a response's locations line up with the
 * field layout without any reshuffling.
 */
export function gridCellCenters(grid: GridSpec): LatLon[] {
  return Array.from({ length: grid.rows * grid.cols }, (_, k) => ({
    lat: grid.lat0 + Math.floor(k / grid.cols) * grid.step,
    lon: grid.lon0 + (k % grid.cols) * grid.step,
  }));
}
