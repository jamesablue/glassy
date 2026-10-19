import type { GridSpec, LatLon } from '../../domain/models';
import { buildViewportLookup, maskOutside } from './viewport-lookup';

describe('buildViewportLookup', () => {
  // 1° cells: rows 0–2 cover 20°N–22°N, columns 0–3 cover 160°W–157°W.
  const grid: GridSpec = { lat0: 20, lon0: -160, step: 1, rows: 3, cols: 4 };
  // A linear stand-in for the map projection: 0.1° per CSS pixel, north up, from 22.5°N 160.5°W.
  const toLatLon = vi.fn((x: number, y: number): LatLon => ({
    lat: 22.5 - y * 0.1,
    lon: -160.5 + x * 0.1,
  }));

  beforeEach(() => toLatLon.mockClear());

  it('finds the grid row of each canvas row and the column of each canvas column', () => {
    const lookup = buildViewportLookup(grid, toLatLon, {
      width: 3,
      height: 2,
      scale: 10,
      offset: 0.5,
    });
    // Canvas row 0 samples screen y = 5 → 22°N, the top grid row; row 1 samples y = 15 → 21°N.
    expect(Array.from(lookup.rows)).toEqual([2, 1]);
    // Columns sample x = 5, 15, 25 → 160°W, 159°W, 158°W.
    expect(Array.from(lookup.cols)).toEqual([0, 1, 2]);
    expect(Array.from(lookup.rowsOutside)).toEqual([0, 0]);
    expect(Array.from(lookup.colsOutside)).toEqual([0, 0, 0]);
  });

  it('clamps positions beyond the grid and reports how far out they are', () => {
    const lookup = buildViewportLookup(grid, toLatLon, {
      width: 1,
      height: 1,
      scale: 1,
      offset: 0,
    });
    // The corner pixel is at 22.5°N 160.5°W: half a cell north and west of the grid.
    expect(lookup.rows[0]).toBe(2);
    expect(lookup.cols[0]).toBe(0);
    expect(lookup.rowsOutside[0]).toBeCloseTo(0.5, 5);
    expect(lookup.colsOutside[0]).toBeCloseTo(0.5, 5);
  });

  it('projects once per row and once per column, not once per pixel', () => {
    buildViewportLookup(grid, toLatLon, { width: 40, height: 30, scale: 1, offset: 0 });
    expect(toLatLon).toHaveBeenCalledTimes(70);
  });
});

describe('maskOutside', () => {
  it('marks positions beyond the limit as missing', () => {
    const masked = maskOutside(Float32Array.of(0, 1, 2), Float32Array.of(0.5, 0, 0.25), 0.3);
    expect(Array.from(masked)).toEqual([NaN, 1, 2]);
  });
});
