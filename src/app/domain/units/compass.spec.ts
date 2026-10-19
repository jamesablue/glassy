import { COMPASS_POINTS, compassPoint, travelBearing } from './compass';

describe('compassPoint', () => {
  it('names every 22.5° step', () => {
    COMPASS_POINTS.forEach((point, i) => {
      expect(compassPoint(i * 22.5)).toBe(point);
    });
  });

  it('rounds to the nearest point, halfway rounding up', () => {
    expect(compassPoint(11.24)).toBe('N');
    expect(compassPoint(11.25)).toBe('NNE');
    expect(compassPoint(100)).toBe('E');
    expect(compassPoint(348.74)).toBe('NNW');
  });

  it('wraps back to north at the top of the circle', () => {
    expect(compassPoint(348.75)).toBe('N');
    expect(compassPoint(359.9)).toBe('N');
    expect(compassPoint(360)).toBe('N');
  });

  it('accepts negative bearings and bearings past 360', () => {
    expect(compassPoint(-90)).toBe('W');
    expect(compassPoint(-11.25)).toBe('N');
    expect(compassPoint(450)).toBe('E');
    expect(compassPoint(720 + 202.5)).toBe('SSW');
  });

  it('has no point for a missing bearing', () => {
    expect(compassPoint(NaN)).toBeUndefined();
  });
});

describe('travelBearing', () => {
  it.each([
    [0, 180],
    [70, 250],
    [200, 20],
    [180, 0],
    [359, 179],
  ])('turns a wind from %s° into one travelling toward %s°', (from, toward) => {
    expect(travelBearing(from)).toBe(toward);
  });

  it('accepts negative bearings and bearings past 360', () => {
    expect(travelBearing(-90)).toBe(90);
    expect(travelBearing(720 + 45)).toBe(225);
  });

  it('has no bearing for a missing direction', () => {
    expect(travelBearing(NaN)).toBeNaN();
  });
});
