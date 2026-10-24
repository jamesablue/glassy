/**
 * The forecast grid: where the map's gridded fields are sampled, and the order a snapshot stores
 * their cells in.
 */

export interface LatLon {
  readonly lat: number;
  readonly lon: number;
}

/**
 * A regular latitude/longitude grid. Cell (row, col) is centered on
 * (`lat0 + row * step`, `lon0 + col * step`), so row 0 is the southern edge and col 0 the western.
 */
export interface GridSpec {
  readonly lat0: number;
  readonly lon0: number;
  /** Distance between neighboring cell centers, degrees. */
  readonly step: number;
  readonly rows: number;
  readonly cols: number;
}

/** The 1/8° forecast grid around Oahu: 11 rows × 15 columns, from 20.875°N 158.875°W. */
export const OAHU_GRID: GridSpec = {
  lat0: 20.875,
  lon0: -158.875,
  step: 0.125,
  rows: 11,
  cols: 15,
};

/**
 * The center of every grid cell in field order: row by row from the south-west corner, so the
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

/** Whether two grid specs describe the same cells. */
export function sameGrid(a: GridSpec, b: GridSpec): boolean {
  return (
    a.lat0 === b.lat0 &&
    a.lon0 === b.lon0 &&
    a.step === b.step &&
    a.rows === b.rows &&
    a.cols === b.cols
  );
}
