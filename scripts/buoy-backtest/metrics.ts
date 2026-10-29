import { angularDifference } from '../../src/app/domain/scoring/angles';

/** One hour at one buoy: what it measured and what a method predicted. */
export interface Pair {
  readonly observed: number;
  readonly predicted: number;
  /** Direction the buoy measured the swell from, degrees. */
  readonly observedDirection: number;
  /** Direction of the model's primary swell where the method reads it, degrees. */
  readonly predictedDirection: number;
}

/** An hour counts as under-predicted when the prediction is this much too low, m. */
export const UNDER_PREDICTION_M = 0.3;

export interface Metrics {
  readonly n: number;
  /** Mean absolute error, m. */
  readonly mae: number;
  /** Mean of predicted − observed, m: negative reads low. */
  readonly bias: number;
  /** Share of hours under-predicted by more than `UNDER_PREDICTION_M`, 0–1. */
  readonly underShare: number;
  /** Mean angle between predicted and observed swell direction, degrees. */
  readonly directionError: number;
}

const mean = (values: readonly number[]): number =>
  values.length === 0 ? NaN : values.reduce((sum, value) => sum + value, 0) / values.length;

/** Error metrics over `pairs`. Hours without a direction are left out of the direction error. */
export function metrics(pairs: readonly Pair[]): Metrics {
  const errors = pairs.map((pair) => pair.predicted - pair.observed);
  const directions = pairs.filter(
    (pair) => Number.isFinite(pair.observedDirection) && Number.isFinite(pair.predictedDirection),
  );
  return {
    n: pairs.length,
    mae: mean(errors.map(Math.abs)),
    bias: mean(errors),
    underShare: mean(errors.map((error) => (error < -UNDER_PREDICTION_M ? 1 : 0))),
    directionError: mean(
      directions.map((pair) => angularDifference(pair.predictedDirection, pair.observedDirection)),
    ),
  };
}

export const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type Sector = (typeof SECTORS)[number];

/** The 45° compass sector a direction falls in, centered on N, NE, E and so on. */
export function sectorOf(direction: number): Sector {
  const index = Math.round((((direction % 360) + 360) % 360) / 45) % 8;
  return SECTORS[index] as Sector;
}

/** The decision rule, set in the plan for #55 before the first run. */
export const DECISION_RULE = {
  /** A and B tie when their MAEs differ by less than this share of the smaller one… */
  tieRelative: 0.1,
  /** …or by less than this, m. */
  tieAbsoluteM: 0.05,
  /** The winner is poor when its MAE is above this, m… */
  poorMaeM: 0.3,
  /** …or its bias is further from zero than this, m. */
  poorBiasM: 0.2,
} as const;

export interface Decision {
  readonly choice: 'A' | 'B';
  readonly tie: boolean;
  /** The winner is too far off to trust either method. */
  readonly poor: boolean;
}

/** Applies the decision rule to the pooled metrics of methods A and B. */
export function decide(a: Metrics, b: Metrics): Decision {
  const difference = Math.abs(a.mae - b.mae);
  const tie =
    difference < DECISION_RULE.tieAbsoluteM ||
    difference < DECISION_RULE.tieRelative * Math.min(a.mae, b.mae);
  const choice = tie || a.mae <= b.mae ? 'A' : 'B';
  const winner = choice === 'A' ? a : b;
  const poor =
    winner.mae > DECISION_RULE.poorMaeM || Math.abs(winner.bias) > DECISION_RULE.poorBiasM;
  return { choice, tie, poor };
}
