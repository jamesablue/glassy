import { CURRENT_PENALTY, SURF_PENALTY, WIND_PENALTY } from './penalty-tables';
import { piecewise, type PiecewiseTable } from './piecewise';

describe('penalty tables', () => {
  describe.each([
    ['SURF_PENALTY', SURF_PENALTY],
    ['WIND_PENALTY', WIND_PENALTY],
    ['CURRENT_PENALTY', CURRENT_PENALTY],
  ])('%s', (_name, table: PiecewiseTable) => {
    it('costs nothing at zero', () => {
      expect(table[0]).toEqual([0, 0]);
    });

    it('has knots in ascending order and never rewards worse conditions', () => {
      for (let i = 1; i < table.length; i++) {
        const [x0, y0] = table[i - 1] ?? [NaN, NaN];
        const [x1, y1] = table[i] ?? [NaN, NaN];
        expect(x1).toBeGreaterThan(x0);
        expect(y1).toBeGreaterThanOrEqual(y0);
      }
    });

    it('costs at most the whole score', () => {
      expect(Math.max(...table.map(([, points]) => points))).toBeLessThanOrEqual(10);
    });
  });

  describe('SURF_PENALTY (feet → points)', () => {
    it.each([
      [-1, 0],
      [0.25, 0.1],
      [0.5, 0.2],
      [1, 0.8],
      [2.5, 3.5],
      [3, 4.5],
      [5.5, 8.75],
      [8, 10],
      [12, 10],
    ])('%s ft costs %s points', (feet, points) => {
      expect(piecewise(SURF_PENALTY, feet)).toBeCloseTo(points, 12);
    });
  });

  describe('WIND_PENALTY (effective knots → points)', () => {
    it.each([
      [-1, 0],
      [3, 0.15],
      [6, 0.3],
      [12, 1.76],
      [20, 4.2],
      [30, 6.9],
      [35, 8],
      [50, 8],
    ])('%s kt costs %s points', (knots, points) => {
      expect(piecewise(WIND_PENALTY, knots)).toBeCloseTo(points, 12);
    });
  });

  describe('CURRENT_PENALTY (knots → points)', () => {
    it.each([
      [-1, 0],
      [0.25, 0],
      [0.5, 0],
      [0.75, 0.3],
      [1, 0.6],
      [1.5, 1.3],
      [2, 2],
      [4, 2],
    ])('%s kt costs %s points', (knots, points) => {
      expect(piecewise(CURRENT_PENALTY, knots)).toBeCloseTo(points, 12);
    });
  });
});
