import { calmSample, NO_WAVES, testSpot } from '../../../testing/domain-builders';
import type { ExposedWaveComponent } from '../models';
import { assessConditions, MAX_SCORE } from './assess-conditions';

describe('assessConditions', () => {
  const northFacing = testSpot({ facing: 0, window: 80, shelter: 0 });
  const headOnSwell = { height: 1, period: 8, direction: 0 };

  it('gives a flat, windless, still hour a perfect score', () => {
    const conditions = assessConditions(northFacing, calmSample());
    expect(conditions.score).toBe(MAX_SCORE);
    expect(conditions.surf).toBe(0);
    expect(conditions.effectiveWind).toBe(0);
    expect(conditions.currentKnots).toBe(0);
  });

  describe('surf', () => {
    it('scales head-on swell by its period and takes off the surf penalty', () => {
      const conditions = assessConditions(northFacing, calmSample({ primarySwell: headOnSwell }));
      // 1 m × full exposure × period factor 1.02 = 1.02 m ≈ 3.35 ft
      expect(conditions.surf).toBeCloseTo(1.02, 12);
      expect(conditions.score).toBeCloseTo(10 - (4.5 + 2 * (1.02 * 3.28084 - 3)), 10);
    });

    it('reduces surf by the spot shelter', () => {
      const sheltered = testSpot({ facing: 0, shelter: 0.5 });
      const conditions = assessConditions(sheltered, calmSample({ primarySwell: headOnSwell }));
      expect(conditions.surf).toBeCloseTo(0.51, 12);
      expect(conditions.score).toBeCloseTo(10 - (0.8 + 1.7 * (0.51 * 3.28084 - 1)), 10);
    });

    it('combines wave trains as the root of the sum of squares', () => {
      const conditions = assessConditions(
        northFacing,
        calmSample({
          primarySwell: headOnSwell,
          secondarySwell: { height: 0.5, period: 14, direction: 0 },
          windWaves: headOnSwell,
        }),
      );
      expect(conditions.surf).toBeCloseTo(Math.hypot(1.02, 0.5 * 1.41, 1.02), 12);
    });

    it('lets only part of off-axis swell reach the spot', () => {
      const conditions = assessConditions(
        northFacing,
        calmSample({ primarySwell: { height: 2, period: 8, direction: 90 } }),
      );
      const [primary] = conditions.components;
      const wrapShare = 0.25 * (1 - 10 / 45);
      expect(primary).toMatchObject({ available: true, exposure: wrapShare });
      expect(conditions.surf).toBeCloseTo(2 * wrapShare * 1.02, 12);
    });

    it('ignores swell from behind the coast', () => {
      const conditions = assessConditions(
        northFacing,
        calmSample({ primarySwell: { height: 4, period: 16, direction: 180 } }),
      );
      expect(conditions.surf).toBe(0);
      expect(conditions.score).toBe(MAX_SCORE);
    });

    it('skips components with no height or no direction', () => {
      const conditions = assessConditions(
        northFacing,
        calmSample({
          primarySwell: { height: NaN, period: 10, direction: 0 },
          secondarySwell: { height: 1, period: 10, direction: NaN },
          windWaves: NO_WAVES,
        }),
      );
      expect(conditions.components.map((c) => c.available)).toEqual([false, false, false]);
      expect(conditions.surf).toBe(0);
      expect(conditions.score).toBe(MAX_SCORE);
    });

    it('assumes an 8 s period when only the period is missing', () => {
      const conditions = assessConditions(
        northFacing,
        calmSample({ windWaves: { height: 1, period: NaN, direction: 0 } }),
      );
      expect(conditions.surf).toBeCloseTo(1.02, 12);
    });

    it('labels the components and keeps their forecast values', () => {
      const secondary = { height: 0.4, period: 13, direction: 20 };
      const { components } = assessConditions(
        northFacing,
        calmSample({ primarySwell: headOnSwell, secondarySwell: secondary }),
      );
      expect(components.map((c) => c.kind)).toEqual([
        'primarySwell',
        'secondarySwell',
        'windWaves',
      ]);
      expect(components[1]).toMatchObject({ ...secondary, available: true });
      expect((components[1] as ExposedWaveComponent).surf).toBeCloseTo(
        0.4 * (0.25 + 0.75 * Math.cos(((20 / 80) * Math.PI) / 2)) * (0.5 + 0.065 * 13),
        12,
      );
    });
  });

  describe('wind', () => {
    const windFrom = (direction: number, speed = 10) =>
      calmSample({ windSpeed: speed, windDirection: direction });

    it('counts onshore wind in full', () => {
      const conditions = assessConditions(northFacing, windFrom(0));
      expect(conditions.relativeWindAngle).toBe(0);
      expect(conditions.windKind).toBe('onshore');
      expect(conditions.effectiveWind).toBeCloseTo(19.43844, 10);
      expect(conditions.score).toBeCloseTo(10 - (2.6 + 1.6 * (4.43844 / 5)), 10);
    });

    it('counts offshore wind at a fifth', () => {
      const conditions = assessConditions(northFacing, windFrom(180));
      expect(conditions.windKind).toBe('offshore');
      expect(conditions.effectiveWind).toBeCloseTo(19.43844 * 0.2, 10);
      expect(conditions.score).toBeCloseTo(10 - (0.3 * (19.43844 * 0.2)) / 6, 10);
    });

    it('counts cross-shore wind at 60%', () => {
      const conditions = assessConditions(northFacing, windFrom(270));
      expect(conditions.relativeWindAngle).toBe(90);
      expect(conditions.windKind).toBe('cross-shore');
      expect(conditions.effectiveWind).toBeCloseTo(19.43844 * 0.6, 10);
    });

    it.each([
      [44.9, 'onshore'],
      [45, 'cross-shore'],
      [135, 'cross-shore'],
      [135.1, 'offshore'],
      [315.1, 'onshore'],
    ])('calls wind from %s° %s', (direction, kind) => {
      expect(assessConditions(northFacing, windFrom(direction)).windKind).toBe(kind);
    });

    it('takes up to 45% off the wind for shelter', () => {
      const lagoon = testSpot({ facing: 0, shelter: 1 });
      expect(assessConditions(lagoon, windFrom(0)).effectiveWind).toBeCloseTo(19.43844 * 0.55, 10);
    });

    it('costs nothing when the wind speed is missing', () => {
      const conditions = assessConditions(northFacing, windFrom(0, NaN));
      expect(conditions.effectiveWind).toBeNaN();
      expect(conditions.score).toBe(MAX_SCORE);
    });

    it('costs nothing when the wind direction is missing', () => {
      const conditions = assessConditions(northFacing, windFrom(NaN));
      expect(conditions.relativeWindAngle).toBeNaN();
      expect(conditions.windKind).toBe('cross-shore');
      expect(conditions.score).toBe(MAX_SCORE);
    });
  });

  describe('current', () => {
    const twoKnots = 2 * 1.852;

    it('converts km/h to knots and takes off the current penalty', () => {
      const conditions = assessConditions(northFacing, calmSample({ currentSpeed: twoKnots }));
      expect(conditions.currentKnots).toBeCloseTo(2, 12);
      expect(conditions.score).toBeCloseTo(8, 10);
    });

    it('reduces the current penalty by the spot shelter', () => {
      const bay = testSpot({ facing: 0, shelter: 0.5 });
      expect(assessConditions(bay, calmSample({ currentSpeed: twoKnots })).score).toBeCloseTo(
        9,
        10,
      );
    });

    it('treats a missing current as none', () => {
      const conditions = assessConditions(northFacing, calmSample({ currentSpeed: NaN }));
      expect(conditions.currentKnots).toBe(0);
      expect(conditions.score).toBe(MAX_SCORE);
    });
  });

  it('never scores below zero', () => {
    const conditions = assessConditions(
      northFacing,
      calmSample({
        primarySwell: { height: 5, period: 16, direction: 0 },
        windSpeed: 20,
        windDirection: 0,
        currentSpeed: 10,
      }),
    );
    expect(conditions.score).toBe(0);
  });

  it('keeps the sample it was worked out from', () => {
    const sample = calmSample({ seaSurfaceTemperature: 27.5, rainChance: 40 });
    expect(assessConditions(northFacing, sample).sample).toBe(sample);
  });
});
