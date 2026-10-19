import type { GridSpec } from '../models';
import { bilinear } from './bilinear';
import { gridPosition } from './grid-position';

describe('bilinear', () => {
  const grid: GridSpec = { lat0: 0, lon0: 0, step: 1, rows: 3, cols: 4 };
  const cells = grid.rows * grid.cols;
  // Two hours of a plane: value = 10 × row + col, plus 100 in the second hour.
  const plane = Float32Array.from({ length: 2 * cells }, (_, k) => {
    const hour = Math.floor(k / cells);
    const cell = k % cells;
    return 100 * hour + 10 * Math.floor(cell / grid.cols) + (cell % grid.cols);
  });

  it('returns grid values exactly at the corners', () => {
    expect(bilinear(grid, plane, 0, 0, 0)).toBe(0);
    expect(bilinear(grid, plane, 0, 0, 3)).toBe(3);
    expect(bilinear(grid, plane, 0, 2, 0)).toBe(20);
    expect(bilinear(grid, plane, 0, 2, 3)).toBe(23);
  });

  it('reproduces a plane anywhere inside', () => {
    expect(bilinear(grid, plane, 0, 1.5, 2.25)).toBeCloseTo(17.25, 5);
    expect(bilinear(grid, plane, 0, 0.1, 0.9)).toBeCloseTo(1.9, 5);
  });

  it('averages the four corners at a cell centre', () => {
    const cell = Float32Array.of(0, 10, 0, 0, 20, 50, 0, 0, 0, 0, 0, 0);
    expect(bilinear(grid, cell, 0, 0.5, 0.5)).toBe(20);
  });

  it('interpolates along the top row and right column using the last full cell', () => {
    expect(bilinear(grid, plane, 0, 2, 1.5)).toBeCloseTo(21.5, 5);
    expect(bilinear(grid, plane, 0, 0.5, 3)).toBeCloseTo(8, 5);
  });

  it('reads the requested hour', () => {
    expect(bilinear(grid, plane, 1, 1.5, 2.25)).toBeCloseTo(117.25, 5);
  });

  it('samples the nearest edge for points outside the grid', () => {
    const { row, col } = gridPosition(grid, -3, 9);
    expect(bilinear(grid, plane, 0, row, col)).toBe(3);
  });

  it('is NaN when a surrounding value is missing', () => {
    const gappy = Float32Array.from(plane.subarray(0, cells));
    gappy[grid.cols + 1] = NaN;
    expect(bilinear(grid, gappy, 0, 0.5, 0.5)).toBeNaN();
    expect(bilinear(grid, gappy, 0, 2, 3)).toBe(23);
  });

  it('is NaN for an hour outside the field', () => {
    expect(bilinear(grid, plane, 2, 0, 0)).toBeNaN();
  });
});
