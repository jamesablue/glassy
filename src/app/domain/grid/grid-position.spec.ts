import type { GridSpec } from '../models';
import { gridPosition } from './grid-position';
import { OAHU_GRID } from './oahu-grid';

describe('gridPosition', () => {
  // 3 rows × 4 columns of 1° cells, row 0 at the equator and column 0 at the prime meridian.
  const grid: GridSpec = { lat0: 0, lon0: 0, step: 1, rows: 3, cols: 4 };

  it('gives fractional rows and columns inside the grid', () => {
    expect(gridPosition(grid, 1.5, 2.25)).toEqual({ row: 1.5, col: 2.25, outside: 0 });
  });

  it('puts points on the outer cell centres exactly on the edge', () => {
    expect(gridPosition(grid, 0, 0)).toEqual({ row: 0, col: 0, outside: 0 });
    expect(gridPosition(grid, 2, 3)).toEqual({ row: 2, col: 3, outside: 0 });
  });

  it.each([
    ['south', -0.5, 1, { row: 0, col: 1, outside: 0.5 }],
    ['north', 3, 1, { row: 2, col: 1, outside: 1 }],
    ['west', 1, -2, { row: 1, col: 0, outside: 2 }],
    ['east', 1, 4.5, { row: 1, col: 3, outside: 1.5 }],
  ])('clamps points to the %s and reports how far out they are', (_side, lat, lon, expected) => {
    expect(gridPosition(grid, lat, lon)).toEqual(expected);
  });

  it('reports the larger distance for points off a corner', () => {
    expect(gridPosition(grid, -1, 5)).toEqual({ row: 0, col: 3, outside: 2 });
    expect(gridPosition(grid, 4.5, -0.5)).toEqual({ row: 2, col: 0, outside: 2.5 });
  });

  it('scales by the cell size', () => {
    expect(gridPosition(OAHU_GRID, 21.125, -158.5)).toEqual({ row: 2, col: 3, outside: 0 });
  });
});
