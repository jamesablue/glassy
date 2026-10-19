/** Limits `value` to the range [`min`, `max`]. `NaN` stays `NaN`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
