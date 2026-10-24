import { gridCellCenters, OAHU_GRID, sameGrid, type GridSpec } from './grid';

describe('gridCellCenters', () => {
  const grid: GridSpec = { lat0: 21, lon0: -158, step: 0.5, rows: 2, cols: 3 };

  it('lists every cell row by row from the south-west corner', () => {
    expect(gridCellCenters(grid)).toEqual([
      { lat: 21, lon: -158 },
      { lat: 21, lon: -157.5 },
      { lat: 21, lon: -157 },
      { lat: 21.5, lon: -158 },
      { lat: 21.5, lon: -157.5 },
      { lat: 21.5, lon: -157 },
    ]);
  });

  it('puts each cell at its field index', () => {
    const cells = gridCellCenters(OAHU_GRID);
    expect(cells).toHaveLength(OAHU_GRID.rows * OAHU_GRID.cols);
    // Row 2, column 3 of the Oahu grid.
    expect(cells[2 * OAHU_GRID.cols + 3]).toEqual({ lat: 21.125, lon: -158.5 });
    expect(cells.at(-1)).toEqual({ lat: 22.125, lon: -157.125 });
  });
});

describe('sameGrid', () => {
  it('compares every field', () => {
    expect(sameGrid(OAHU_GRID, { ...OAHU_GRID })).toBe(true);
    for (const field of ['lat0', 'lon0', 'step', 'rows', 'cols'] as const) {
      expect(sameGrid(OAHU_GRID, { ...OAHU_GRID, [field]: OAHU_GRID[field] + 1 })).toBe(false);
    }
  });
});
