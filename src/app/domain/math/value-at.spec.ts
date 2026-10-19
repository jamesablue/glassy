import { valueAt } from './value-at';

describe('valueAt', () => {
  const values = Float32Array.of(1.5, NaN, 3);

  it('reads values by index', () => {
    expect(valueAt(values, 0)).toBe(1.5);
    expect(valueAt(values, 2)).toBe(3);
  });

  it('passes missing values through as NaN', () => {
    expect(valueAt(values, 1)).toBeNaN();
  });

  it('reads indices outside the series as NaN', () => {
    expect(valueAt(values, -1)).toBeNaN();
    expect(valueAt(values, 3)).toBeNaN();
    expect(valueAt([], 0)).toBeNaN();
  });
});
