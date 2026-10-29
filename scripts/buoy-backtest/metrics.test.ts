import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decide, metrics, sectorOf, type Metrics, type Pair } from './metrics';
import { predictHeight } from './predict';
import { asSpot, BUOYS } from './buoys';

const pair = (
  observed: number,
  predicted: number,
  directions: [number, number] = [180, 190],
): Pair => ({
  observed,
  predicted,
  observedDirection: directions[0],
  predictedDirection: directions[1],
});

const close = (actual: number, expected: number): void =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

describe('metrics', () => {
  it('computes MAE, bias, under-prediction and direction error', () => {
    const result = metrics([
      pair(1.0, 1.2, [350, 10]),
      pair(1.0, 0.6, [180, 200]),
      pair(1.0, 1.0, [180, NaN]),
      pair(2.0, 1.5, [90, 90]),
    ]);
    assert.equal(result.n, 4);
    close(result.mae, (0.2 + 0.4 + 0 + 0.5) / 4);
    close(result.bias, (0.2 - 0.4 + 0 - 0.5) / 4);
    close(result.underShare, 2 / 4);
    close(result.directionError, (20 + 20 + 0) / 3);
  });

  it('is NaN with no pairs', () => {
    assert.ok(Number.isNaN(metrics([]).mae));
  });
});

describe('sectorOf', () => {
  it('centers sectors on the compass points', () => {
    assert.equal(sectorOf(0), 'N');
    assert.equal(sectorOf(22), 'N');
    assert.equal(sectorOf(23), 'NE');
    assert.equal(sectorOf(184), 'S');
    assert.equal(sectorOf(337.5), 'N');
    assert.equal(sectorOf(-90), 'W');
  });
});

describe('decide', () => {
  const at = (mae: number, bias = 0): Metrics => ({
    n: 1,
    mae,
    bias,
    underShare: 0,
    directionError: 0,
  });

  it('picks the lower error', () => {
    assert.deepEqual(decide(at(0.25), at(0.15)), { choice: 'B', tie: false, poor: false });
    assert.deepEqual(decide(at(0.15), at(0.25)), { choice: 'A', tie: false, poor: false });
  });

  it('gives a near tie to A', () => {
    assert.deepEqual(decide(at(0.2), at(0.16)), { choice: 'A', tie: true, poor: false });
    assert.deepEqual(decide(at(0.8), at(0.75)), { choice: 'A', tie: true, poor: true });
  });

  it('flags a poor winner by error or bias', () => {
    assert.equal(decide(at(0.5), at(0.35)).poor, true);
    assert.equal(decide(at(0.5), at(0.2, -0.25)).poor, true);
    assert.equal(decide(at(0.5), at(0.2, -0.15)).poor, false);
  });
});

describe('predictHeight', () => {
  const hour = {
    swellHeight: 1.2,
    swellDirection: 184,
    swellPeriod: 14,
    secondaryHeight: 0.5,
    secondaryDirection: 340,
    windWaveHeight: 0.8,
    windWaveDirection: 70,
  };

  it('combines the swell trains by energy without exposure (A)', () => {
    close(predictHeight(hour, 'swell'), Math.sqrt(1.2 ** 2 + 0.5 ** 2));
    close(predictHeight(hour, 'all'), Math.sqrt(1.2 ** 2 + 0.5 ** 2 + 0.8 ** 2));
  });

  it('scales each train by exposure at the buoy (B)', () => {
    // 51212 faces 220° with a 115° window: 184° is 36° off axis, inside the window, and 340° is
    // 120° off, 5° into the wrap zone.
    const barbers = asSpot(BUOYS.find((buoy) => buoy.id === '51212')!);
    const primary = 0.25 + 0.75 * Math.cos(((36 / 115) * Math.PI) / 2);
    const secondary = 0.25 * (1 - 5 / 45);
    close(
      predictHeight(hour, 'swell', barbers),
      Math.sqrt((1.2 * primary) ** 2 + (0.5 * secondary) ** 2),
    );
  });
});
