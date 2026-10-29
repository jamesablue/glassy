import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SpotHourSample } from '../../src/app/domain/models';
import { FEET_PER_METER } from '../../src/app/domain/units/conversions';
import { samplingPoints, scoreReadings } from './analysis';
import { BEACHES } from './beaches';
import { metrics, sectorOf, type Pair } from './metrics';
import type { Observation } from './omr';
import type { SampleSeries } from './open-meteo';
import { BASELINE, CANDIDATES, fingerprint, spotFor } from './settings';

const pair = (low: number, high: number, estimate: number, range: [number, number]): Pair => ({
  low,
  high,
  estimate,
  rangeLow: range[0],
  rangeHigh: range[1],
});

const close = (actual: number, expected: number): void =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

describe('metrics', () => {
  it('computes overlap, MAE, bias and the share more than 1 ft too low', () => {
    const result = metrics([
      pair(1, 2, 1.2, [1, 2]), // overlaps, −0.3
      pair(3, 4, 1.5, [1, 2]), // misses, −2.0, more than 1 ft below 3
      pair(0, 0, 0.2, [0, 0]), // flat and flat, +0.2
      pair(2, 3, 4.0, [3, 5]), // overlaps at 3, +1.5
    ]);
    assert.equal(result.n, 4);
    close(result.overlap, 3 / 4);
    close(result.mae, (0.3 + 2 + 0.2 + 1.5) / 4);
    close(result.bias, (-0.3 - 2 + 0.2 + 1.5) / 4);
    close(result.tooLow, 1 / 4);
  });

  it('counts exactly 1 ft below the low end as not too low', () => {
    assert.equal(metrics([pair(2, 3, 1, [1, 2])]).tooLow, 0);
  });

  it('is NaN with nothing to measure', () => {
    assert.ok(Number.isNaN(metrics([]).mae));
  });
});

describe('sectorOf', () => {
  it('centers sectors on the compass points', () => {
    assert.equal(sectorOf(350), 'N');
    assert.equal(sectorOf(22), 'N');
    assert.equal(sectorOf(23), 'NE');
    assert.equal(sectorOf(184), 'S');
    assert.equal(sectorOf(-90), 'W');
  });
});

const makaha = BEACHES.findIndex((beach) => beach.omr === 'MAKAHA');
const HOUR = Date.UTC(2026, 9, 28, 21) / 1000;

/** A sample with only a primary swell, head-on to Mākaha. */
const sample = (heightMeters: number, direction = 270): SpotHourSample => ({
  primarySwell: { height: heightMeters, period: 8, direction },
  secondarySwell: { height: NaN, period: NaN, direction: NaN },
  windWaves: { height: NaN, period: NaN, direction: NaN },
  windSpeed: NaN,
  windDirection: NaN,
  windGust: NaN,
  currentSpeed: NaN,
  currentDirection: NaN,
  seaSurfaceTemperature: NaN,
  seaLevel: NaN,
  seaLevelNextHour: NaN,
  rainChance: NaN,
  isDay: true,
});

const seriesWith = (hours: Map<number, SpotHourSample>): SampleSeries[] =>
  BEACHES.map((_, index) => ({
    cell: { lat: 0, lon: 0 },
    hours: index === makaha ? hours : new Map(),
  }));

const reading = (time: number): Observation => ({
  beach: 'MAKAHA',
  time,
  low: 1,
  high: 2,
  timeBorrowed: false,
});

describe('scoreReadings', () => {
  it('scores a reading at the nearest model hour with the real scoring code', () => {
    const series = seriesWith(new Map([[HOUR, sample(0.4)]]));
    // 10:49 AM HST is 20:49 UTC, nearest the 21:00 model hour.
    const rows = scoreReadings([reading(HOUR - 11 * 60)], BEACHES, series, BASELINE);
    assert.equal(rows.length, 1);
    const row = rows[0]!;
    assert.equal(row.hour, HOUR);
    assert.equal(row.sector, 'W');
    // Head-on, 8 s (factor 1.02), Mākaha's shelter 0.05.
    close(row.estimate, 0.4 * 1.02 * 0.95 * FEET_PER_METER);
    assert.deepEqual([row.rangeLow, row.rangeHigh], [1, 2]);
  });

  it('leaves out readings with no model hour or no wave data', () => {
    const empty = sample(NaN);
    const series = seriesWith(new Map([[HOUR, empty]]));
    assert.equal(scoreReadings([reading(HOUR)], BEACHES, series, BASELINE).length, 0);
    assert.equal(scoreReadings([reading(HOUR + 7200)], BEACHES, series, BASELINE).length, 0);
  });

  it('applies the settings geometry before scoring', () => {
    const series = seriesWith(new Map([[HOUR, sample(0.3, 180)]]));
    const turned = { ...BASELINE, name: 'turned', geometry: { MAKAHA: { facing: 180 } } };
    const [today] = scoreReadings([reading(HOUR)], BEACHES, series, BASELINE);
    const [facingSouth] = scoreReadings([reading(HOUR)], BEACHES, series, turned);
    assert.ok(facingSouth!.estimate > today!.estimate);
  });
});

describe('settings', () => {
  it('reads Mākaha where the ingest does today', () => {
    const point = samplingPoints(BEACHES, BASELINE)[makaha]!;
    assert.ok(point.lon < spotFor(BEACHES[makaha]!, BASELINE).lon);
  });

  it('gives different settings different fingerprints', () => {
    const candidate = CANDIDATES[0]!;
    assert.notEqual(fingerprint(BASELINE, BEACHES), fingerprint(candidate, BEACHES));
    assert.equal(fingerprint(BASELINE, BEACHES), fingerprint({ ...BASELINE }, BEACHES));
  });

  it('keeps the test beaches out of the catalog', () => {
    assert.deepEqual(
      BEACHES.filter((beach) => beach.kind === 'catalog').map((beach) => beach.spot.id),
      ['diamondhead', 'makaha'],
    );
  });
});
