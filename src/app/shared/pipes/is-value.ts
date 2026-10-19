/** Whether a forecast value is there to format: a finite number, not `NaN`, `null` or `undefined`. */
export function isValue(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
