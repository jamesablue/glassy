/**
 * How a snapshot stores one hourly series compactly, losslessly for values with at most `decimals`
 * decimal places. Each value is scaled by `10^decimals` to an integer, the series is stored location
 * by location rather than hour by hour, and each hour holds only the change from the hour before.
 * Neighboring hours at one location are close, so the changes are small and repeat, which is what
 * makes the file compress well (measured in #39 and ADR-0011).
 */
export interface EncodedSeries {
  /** Values are stored multiplied by `10^decimals`, as integers. */
  readonly decimals: number;
  /**
   * Location-major: one run of `hourCount` integers per location, in location order. The first
   * value in a run is the scaled value itself; each later one is the change from the previous value
   * that is not `null`. `null` where the model has no data.
   */
  readonly deltas: readonly (number | null)[];
}

/** The most decimal places a series may keep: beyond this the scaled integers lose precision. */
export const MAX_SERIES_DECIMALS = 6;

/**
 * Encodes an hour-major series (index = `hour * locationCount + location`) as an
 * {@link EncodedSeries}. Values are rounded to `decimals` places.
 *
 * @throws RangeError when the series is not a whole number of hours, or `decimals` is out of range
 */
export function encodeSeries(
  hourMajor: readonly (number | null)[],
  locationCount: number,
  decimals: number,
): EncodedSeries {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_SERIES_DECIMALS) {
    throw new RangeError(`A series keeps 0 to ${MAX_SERIES_DECIMALS} decimals, not ${decimals}`);
  }
  const hourCount = hoursIn(hourMajor.length, locationCount);
  const scale = 10 ** decimals;
  const deltas: (number | null)[] = [];
  for (let location = 0; location < locationCount; location++) {
    let previous = 0;
    for (let hour = 0; hour < hourCount; hour++) {
      const value = hourMajor[hour * locationCount + location];
      if (value === null || value === undefined) {
        deltas.push(null);
        continue;
      }
      // `+ 0` turns the -0 that Math.round gives for small negative values into 0.
      const scaled = Math.round(value * scale) + 0;
      deltas.push(scaled - previous);
      previous = scaled;
    }
  }
  return { decimals, deltas };
}

/**
 * Decodes an {@link EncodedSeries} back to an hour-major series (index = `hour * locationCount +
 * location`), `NaN` where the model has no data. Dividing the integer by `10^decimals` gives the
 * same number as parsing the original decimal, so the 32-bit values match the source exactly.
 *
 * @throws RangeError when the series is not a whole number of hours
 */
export function decodeSeries(series: EncodedSeries, locationCount: number): Float32Array {
  const { deltas } = series;
  const hourCount = hoursIn(deltas.length, locationCount);
  const scale = 10 ** series.decimals;
  const values = new Float32Array(deltas.length);
  for (let location = 0; location < locationCount; location++) {
    let current = 0;
    for (let hour = 0; hour < hourCount; hour++) {
      const delta = deltas[location * hourCount + hour];
      if (delta === null || delta === undefined) {
        values[hour * locationCount + location] = NaN;
        continue;
      }
      current += delta;
      values[hour * locationCount + location] = current / scale;
    }
  }
  return values;
}

function hoursIn(length: number, locationCount: number): number {
  if (!Number.isInteger(locationCount) || locationCount < 1 || length % locationCount !== 0) {
    throw new RangeError(`${length} values are not a whole number of hours for ${locationCount}`);
  }
  return length / locationCount;
}
