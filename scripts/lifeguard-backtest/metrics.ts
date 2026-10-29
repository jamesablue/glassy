/** One lifeguard reading next to Glassy's estimate for that beach and hour. */
export interface Pair {
  /** Lifeguard full-face range, ft. */
  readonly low: number;
  readonly high: number;
  /** Glassy's estimate, ft. */
  readonly estimate: number;
  /** The range Glassy displays for it, ft. Flat is 0–0. */
  readonly rangeLow: number;
  readonly rangeHigh: number;
}

/** A reading counts as too low when the estimate is more than this below the lifeguard's low end, ft. */
export const TOO_LOW_FT = 1;

export interface Metrics {
  readonly n: number;
  /** Share of readings where Glassy's range and the lifeguard's share a value, 0–1. */
  readonly overlap: number;
  /** Mean absolute error of the estimate against the lifeguard midpoint, ft. */
  readonly mae: number;
  /** Mean of estimate − lifeguard midpoint, ft: negative reads low. */
  readonly bias: number;
  /** Share of readings more than `TOO_LOW_FT` below the lifeguard's low end, 0–1. */
  readonly tooLow: number;
}

const mean = (values: readonly number[]): number =>
  values.length === 0 ? NaN : values.reduce((sum, value) => sum + value, 0) / values.length;

export const overlaps = (pair: Pair): boolean =>
  pair.rangeLow <= pair.high && pair.low <= pair.rangeHigh;

export const error = (pair: Pair): number => pair.estimate - (pair.low + pair.high) / 2;

export const tooLow = (pair: Pair): boolean => pair.estimate < pair.low - TOO_LOW_FT;

export function metrics(pairs: readonly Pair[]): Metrics {
  const errors = pairs.map(error);
  return {
    n: pairs.length,
    overlap: mean(pairs.map((pair) => (overlaps(pair) ? 1 : 0))),
    mae: mean(errors.map(Math.abs)),
    bias: mean(errors),
    tooLow: mean(pairs.map((pair) => (tooLow(pair) ? 1 : 0))),
  };
}

export const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type Sector = (typeof SECTORS)[number];

/** The 45° compass sector a direction falls in, centered on N, NE, E and so on. */
export function sectorOf(direction: number): Sector {
  const index = Math.round((((direction % 360) + 360) % 360) / 45) % 8;
  return SECTORS[index] as Sector;
}
