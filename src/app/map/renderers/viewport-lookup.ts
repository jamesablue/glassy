import { gridPosition } from '../../domain/grid';
import { valueAt } from '../../domain/math';
import type { GridSpec } from '../../domain/models';
import type { ContainerToLatLon } from './map-view';

/**
 * The fractional grid row of every canvas row and the grid column of every canvas column, plus how
 * far outside the grid each one lies (in cells, 0 inside).
 *
 * Web Mercator is separable: latitude depends only on the screen row and longitude only on the
 * column. A `width × height` canvas therefore needs `width + height` projections, not one per pixel.
 */
export interface ViewportLookup {
  readonly rows: Float32Array;
  readonly rowsOutside: Float32Array;
  readonly cols: Float32Array;
  readonly colsOutside: Float32Array;
}

/** How canvas pixels sit over the map container. */
export interface CanvasSampling {
  /** Canvas size in canvas pixels. */
  readonly width: number;
  readonly height: number;
  /** CSS pixels per canvas pixel (3 for the field, which is drawn small and upscaled). */
  readonly scale: number;
  /** Where in each canvas pixel to sample: 0.5 for its centre, 0 for its top-left corner. */
  readonly offset: number;
}

export function buildViewportLookup(
  grid: GridSpec,
  toLatLon: ContainerToLatLon,
  { width, height, scale, offset }: CanvasSampling,
): ViewportLookup {
  const rows = new Float32Array(height);
  const rowsOutside = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    const position = gridPosition(grid, toLatLon(0, (y + offset) * scale).lat, grid.lon0);
    rows[y] = position.row;
    rowsOutside[y] = position.outside;
  }

  const cols = new Float32Array(width);
  const colsOutside = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const position = gridPosition(grid, grid.lat0, toLatLon((x + offset) * scale, 0).lon);
    cols[x] = position.col;
    colsOutside[x] = position.outside;
  }

  return { rows, rowsOutside, cols, colsOutside };
}

/** A copy of `positions` with `NaN` wherever the matching `outside` distance exceeds `limit`. */
export function maskOutside(
  positions: Float32Array,
  outside: Float32Array,
  limit: number,
): Float32Array {
  return positions.map((position, index) => (valueAt(outside, index) > limit ? NaN : position));
}
