import type { GridPosition, GridSpec } from '../models';

/**
 * A point's fractional row and column on the grid. Points beyond the edge are clamped onto it, and
 * `outside` reports how many cells away they were (the larger of the two axes), so callers can
 * fade or drop them.
 */
export function gridPosition(grid: GridSpec, lat: number, lon: number): GridPosition {
  const row = clampToAxis((lat - grid.lat0) / grid.step, grid.rows);
  const col = clampToAxis((lon - grid.lon0) / grid.step, grid.cols);
  return { row: row.index, col: col.index, outside: Math.max(row.outside, col.outside) };
}

function clampToAxis(index: number, size: number): { index: number; outside: number } {
  if (index < 0) return { index: 0, outside: -index };
  if (index > size - 1) return { index: size - 1, outside: index - size + 1 };
  return { index, outside: 0 };
}
