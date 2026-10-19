import { piecewise, type PiecewiseTable } from './piecewise';

describe('piecewise', () => {
  const table: PiecewiseTable = [
    [0, 0],
    [1, 10],
    [3, 20],
  ];

  it('returns the first value below the table', () => {
    expect(piecewise(table, -5)).toBe(0);
  });

  it('returns the knot value on each knot', () => {
    expect(piecewise(table, 0)).toBe(0);
    expect(piecewise(table, 1)).toBe(10);
    expect(piecewise(table, 3)).toBe(20);
  });

  it('interpolates linearly between knots', () => {
    expect(piecewise(table, 0.5)).toBe(5);
    expect(piecewise(table, 2)).toBe(15);
    expect(piecewise(table, 2.5)).toBe(17.5);
  });

  it('holds the last value above the table', () => {
    expect(piecewise(table, 3.01)).toBe(20);
    expect(piecewise(table, 1e9)).toBe(20);
    expect(piecewise(table, Infinity)).toBe(20);
  });

  it('treats NaN like a value below the table', () => {
    expect(piecewise(table, NaN)).toBe(0);
  });

  it('works with a single knot', () => {
    expect(piecewise([[2, 7]], 0)).toBe(7);
    expect(piecewise([[2, 7]], 5)).toBe(7);
  });

  it('handles flat segments', () => {
    const flatStart: PiecewiseTable = [
      [0, 0],
      [0.5, 0],
      [1, 0.6],
    ];
    expect(piecewise(flatStart, 0.25)).toBe(0);
    expect(piecewise(flatStart, 0.75)).toBeCloseTo(0.3, 12);
  });
});
