import { decodeSeries, encodeSeries } from './series-codec';

describe('encodeSeries', () => {
  // Two locations, three hours, hour-major: [h0 l0, h0 l1, h1 l0, h1 l1, h2 l0, h2 l1].
  const hourMajor = [1.42, 0.3, 1.44, 0.25, 1.4, 0.25];

  it('stores each location as a run of changes from the hour before, in scaled integers', () => {
    expect(encodeSeries(hourMajor, 2, 2)).toEqual({
      decimals: 2,
      deltas: [142, 2, -4, 30, -5, 0],
    });
  });

  it('keeps null and carries the last value across it', () => {
    expect(encodeSeries([5, null, 7, 6], 1, 0).deltas).toEqual([5, null, 2, -1]);
    expect(encodeSeries([null, 3], 1, 0).deltas).toEqual([null, 3]);
  });

  it('handles negative values without writing -0', () => {
    const { deltas } = encodeSeries([-0.004, -0.31, -0.29], 1, 2);
    expect(deltas).toEqual([0, -31, 2]);
    expect(Object.is(deltas[0], -0)).toBe(false);
  });

  it('rounds to the decimals asked for', () => {
    expect(encodeSeries([245.4, 245.6], 1, 0).deltas).toEqual([245, 1]);
  });

  it.each([-1, 7, 1.5])('refuses %d decimals', (decimals) => {
    expect(() => encodeSeries([1], 1, decimals)).toThrow(RangeError);
  });

  it('refuses a series that is not a whole number of hours', () => {
    expect(() => encodeSeries([1, 2, 3], 2, 0)).toThrow(RangeError);
  });
});

describe('decodeSeries', () => {
  it('restores the hour-major series exactly as 32-bit floats, NaN where missing', () => {
    const hourMajor = [1.42, 0.3, null, 0.25, 1.4, -0.07, 26.9, 0.01];
    const decoded = decodeSeries(encodeSeries(hourMajor, 2, 2), 2);
    expect(decoded).toEqual(Float32Array.from(hourMajor, (value) => value ?? NaN));
  });

  it('round-trips values with as many decimals as the series keeps', () => {
    const values = Array.from(
      { length: 500 },
      // `+ 0` because -0 and 0 are the same value, and encoding does not keep the sign of zero.
      (_, index) => Math.round(Math.sin(index) * 1e4) / 1e2 + 0,
    );
    const decoded = decodeSeries(encodeSeries(values, 5, 2), 5);
    expect(decoded).toEqual(Float32Array.from(values));
  });

  it('refuses a series that is not a whole number of hours', () => {
    expect(() => decodeSeries({ decimals: 0, deltas: [1, 2, 3] }, 2)).toThrow(RangeError);
  });
});
