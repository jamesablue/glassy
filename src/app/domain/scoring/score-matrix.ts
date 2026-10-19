import { sampleSpot } from '../forecast/spot-sample';
import { valueAt } from '../math/value-at';
import type { Spot, SpotForecast } from '../models';
import { assessConditions } from './assess-conditions';

/** Every spot's score for every forecast hour. */
export interface ScoreMatrix {
  readonly spotCount: number;
  readonly hourCount: number;
  /** index = `spotIndex * hourCount + hour`, so each spot's hours sit next to each other. */
  readonly scores: Float32Array;
}

/**
 * Scores every spot for every forecast hour. This runs once per forecast load; rankings, map pins
 * and charts then read from the matrix instead of re-assessing conditions.
 *
 * @param spots the catalog, in the same order the forecast was built in
 * @throws RangeError when the forecast was built for a different number of spots
 */
export function computeScoreMatrix(spots: readonly Spot[], forecast: SpotForecast): ScoreMatrix {
  const { spotCount, hourCount } = forecast;
  if (spots.length !== spotCount) {
    throw new RangeError(`The forecast has ${spotCount} spots but the catalog has ${spots.length}`);
  }
  const scores = new Float32Array(spotCount * hourCount);
  spots.forEach((spot, spotIndex) => {
    for (let hour = 0; hour < hourCount; hour++) {
      const sample = sampleSpot(forecast, spotIndex, hour);
      scores[spotIndex * hourCount + hour] = assessConditions(spot, sample).score;
    }
  });
  return { spotCount, hourCount, scores };
}

export function scoreAt(matrix: ScoreMatrix, spotIndex: number, hour: number): number {
  return valueAt(matrix.scores, spotIndex * matrix.hourCount + hour);
}

/** One spot's score for each forecast hour, as a view into the matrix. */
export function spotScores(matrix: ScoreMatrix, spotIndex: number): ArrayLike<number> {
  const start = spotIndex * matrix.hourCount;
  return matrix.scores.subarray(start, start + matrix.hourCount);
}

/**
 * Spot indices from best to worst score at an hour. Equal scores keep their given order.
 *
 * @param spotIndices the spots to rank, for example one region's; defaults to every spot
 */
export function rankSpots(
  matrix: ScoreMatrix,
  hour: number,
  spotIndices: readonly number[] = Array.from({ length: matrix.spotCount }, (_, i) => i),
): number[] {
  return [...spotIndices].sort((a, b) => scoreAt(matrix, b, hour) - scoreAt(matrix, a, hour));
}
