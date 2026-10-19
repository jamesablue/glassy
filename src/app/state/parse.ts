/**
 * Narrowing helpers for values the app does not control: localStorage records and URL parameters.
 * Anything that fails a check is treated as missing, so bad input falls back to a default instead
 * of reaching a store.
 */

/** `value` as one of `allowed`, or `undefined` when it is anything else. */
export function oneOf<const T extends string>(
  allowed: readonly T[],
  value: unknown,
): T | undefined {
  return allowed.find((option) => option === value);
}

/** `value` as a plain object whose properties can be checked one by one, or an empty object. */
export function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** `value` when it is a boolean, otherwise `fallback`. */
export function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}
