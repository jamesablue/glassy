import { OAHU_SPOTS, type LatLon } from '@glassy/shared';
import { testSpot } from '../testing/builders';
import { offshorePoint, samplingPoint } from './offshore-point';

/** Great-circle distance, km. */
function haversineKm(a: LatLon, b: LatLon): number {
  const radians = (degrees: number): number => (degrees * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

describe('offshorePoint', () => {
  it('moves straight north from a north-facing spot', () => {
    const spot = testSpot({ lat: 21, lon: -158, facing: 0 });
    const point = offshorePoint(spot);
    expect(point.lat).toBeCloseTo(21 + 6 / 111.32, 10);
    expect(point.lon).toBeCloseTo(-158, 10);
  });

  it('moves east from an east-facing spot, allowing for narrower longitude degrees', () => {
    const spot = testSpot({ lat: 21, lon: -158, facing: 90 });
    const point = offshorePoint(spot);
    expect(point.lat).toBeCloseTo(21, 10);
    expect(point.lon).toBeCloseTo(-158 + 6 / (111.32 * Math.cos((21 * Math.PI) / 180)), 10);
  });

  it('lands about 6 km out in front of every catalog spot', () => {
    for (const spot of OAHU_SPOTS) {
      expect(haversineKm(spot, offshorePoint(spot))).toBeCloseTo(6, 1);
    }
  });

  it('accepts another distance', () => {
    const spot = testSpot({ facing: 225 });
    expect(haversineKm(spot, offshorePoint(spot, 2))).toBeCloseTo(2, 1);
  });
});

describe('samplingPoint', () => {
  it('uses the spot’s own sample point when it sets one, whatever its facing', () => {
    const sample = { lat: 21.5, lon: -158.3 };
    expect(samplingPoint(testSpot({ facing: 90, sample }))).toEqual(sample);
    expect(samplingPoint(testSpot({ facing: 270, sample }), 2)).toEqual(sample);
  });

  it('falls back to the offshore point for a spot without one', () => {
    const spot = testSpot({ facing: 225 });
    expect(samplingPoint(spot, 2)).toEqual(offshorePoint(spot, 2));
  });

  it('is set for every catalog spot, in open water about 6 km out', () => {
    for (const spot of OAHU_SPOTS) {
      expect(spot.sample).toBeDefined();
      expect(haversineKm(spot, samplingPoint(spot))).toBeCloseTo(6, 1);
    }
  });
});
