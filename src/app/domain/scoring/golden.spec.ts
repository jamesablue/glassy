import expected from '../../../testing/fixtures/spot-forecast.expected.json';
import fixture from '../../../testing/fixtures/spot-forecast.fixture.json';
import { spotForecastFromFixture } from '../../../testing/spot-forecast';
import { sampleSpot } from '../forecast/spot-sample';
import { OAHU_SPOTS } from '../spots/oahu.spots';
import { assessConditions } from './assess-conditions';
import { computeScoreMatrix, rankSpots } from './score-matrix';

/**
 * Golden test: real Open-Meteo data for every spot, scored by the original prototype
 * (scripts/generate-expected-scores.mjs) and by the port. Any change to the scoring model shows up
 * here as a diff against the prototype's numbers.
 */
describe('golden parity with the prototype', () => {
  const TOLERANCE = 1e-6;
  const forecast = spotForecastFromFixture(fixture);
  const hours = fixture.times.length;
  const idsInOrder = (indices: readonly number[]): string[] =>
    indices.map((index) => OAHU_SPOTS[index]?.id ?? `#${index}`);

  it('covers the whole catalog for at least a day', () => {
    expect(fixture.spotIds).toEqual(OAHU_SPOTS.map((spot) => spot.id));
    expect(expected.spots.map((spot) => spot.id)).toEqual(fixture.spotIds);
    expect(hours).toBeGreaterThanOrEqual(24);
  });

  it('reproduces every score and surf height', () => {
    const mismatches: string[] = [];
    OAHU_SPOTS.forEach((spot, spotIndex) => {
      const want = expected.spots[spotIndex];
      for (let hour = 0; hour < hours; hour++) {
        const got = assessConditions(spot, sampleSpot(forecast, spotIndex, hour));
        const wantScore = want?.score[hour] ?? NaN;
        const wantSurf = want?.surf[hour] ?? NaN;
        if (!(Math.abs(got.score - wantScore) <= TOLERANCE)) {
          mismatches.push(`${spot.id} hour ${hour}: score ${got.score}, prototype ${wantScore}`);
        }
        if (!(Math.abs(got.surf - wantSurf) <= TOLERANCE)) {
          mismatches.push(`${spot.id} hour ${hour}: surf ${got.surf}, prototype ${wantSurf}`);
        }
      }
    });
    expect(mismatches).toEqual([]);
  });

  describe('ranking', () => {
    const matrix = computeScoreMatrix(OAHU_SPOTS, forecast);

    it('ranks the first hour in the same order', () => {
      expect(idsInOrder(rankSpots(matrix, 0))).toEqual(expected.rankings[0]);
    });

    it('ranks every hour in the same order', () => {
      const rankings = Array.from({ length: hours }, (_, hour) =>
        idsInOrder(rankSpots(matrix, hour)),
      );
      expect(rankings).toEqual(expected.rankings);
    });
  });
});
