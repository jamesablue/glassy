/** Reads one value from a numeric series. An index outside the series reads as missing (`NaN`). */
export function valueAt(values: ArrayLike<number>, index: number): number {
  return values[index] ?? NaN;
}
