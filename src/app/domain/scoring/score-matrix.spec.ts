import { testSpot } from '../../../testing/domain-builders';
import { buildSpotForecast } from '../../../testing/spot-forecast';
import { sampleSpot } from '../forecast/spot-sample';
import type { SpotVariable } from '../models';
import { assessConditions } from './assess-conditions';
import { computeScoreMatrix, rankSpots, scoreAt, spotScores } from './score-matrix';

describe('score matrix', () => {
  const spots = [
    testSpot({ id: 'exposed', facing: 0, shelter: 0 }),
    testSpot({ id: 'lagoon', facing: 0, shelter: 0.9 }),
    testSpot({ id: 'leeward', facing: 180, shelter: 0 }),
  ];
  // A north swell that builds over three hours, with no wind or current.
  const forecast = buildSpotForecast(3, 3, (variable: SpotVariable, _spot, hour) => {
    switch (variable) {
      case 'swellHeight':
        return 0.5 * hour;
      case 'swellPeriod':
        return 12;
      case 'swellDirection':
        return 0;
      case 'isDay':
        return 1;
      default:
        return variable.endsWith('Height') || variable.endsWith('Period') ? null : 0;
    }
  });
  const matrix = computeScoreMatrix(spots, forecast);

  it('scores every spot for every hour with assessConditions', () => {
    expect(matrix.spotCount).toBe(3);
    expect(matrix.hourCount).toBe(3);
    spots.forEach((spot, spotIndex) => {
      for (let hour = 0; hour < 3; hour++) {
        const expected = assessConditions(spot, sampleSpot(forecast, spotIndex, hour)).score;
        expect(scoreAt(matrix, spotIndex, hour)).toBe(Math.fround(expected));
      }
    });
  });

  it('stores each spot’s hours next to each other', () => {
    expect(matrix.scores[1 * 3 + 2]).toBe(scoreAt(matrix, 1, 2));
    expect(Array.from(spotScores(matrix, 0))).toEqual([
      scoreAt(matrix, 0, 0),
      scoreAt(matrix, 0, 1),
      scoreAt(matrix, 0, 2),
    ]);
  });

  it('reads outside the matrix as NaN', () => {
    expect(scoreAt(matrix, 3, 0)).toBeNaN();
  });

  it('rejects a forecast built for a different catalog', () => {
    expect(() => computeScoreMatrix(spots.slice(0, 2), forecast)).toThrow(RangeError);
  });

  describe('rankSpots', () => {
    it('orders every spot from best to worst score', () => {
      expect(rankSpots(matrix, 2)).toEqual([2, 1, 0]);
    });

    it('ranks only the given spots', () => {
      expect(rankSpots(matrix, 2, [0, 1])).toEqual([1, 0]);
    });

    it('keeps the given order for equal scores', () => {
      expect(rankSpots(matrix, 0)).toEqual([0, 1, 2]);
      expect(rankSpots(matrix, 0, [2, 0, 1])).toEqual([2, 0, 1]);
    });
  });
});
