import type { GridForecast, GridSpec } from '../models';
import { MAX_CELLS_OUTSIDE, samplePoint } from './sample-point';
import { toVectorField } from './vector-field';

describe('samplePoint', () => {
  const spec: GridSpec = { lat0: 21, lon0: -158, step: 0.5, rows: 2, cols: 2 };
  const field = (...values: number[]): Float32Array => Float32Array.from(values);
  // Wind from 350° on the west column and from 10° on the east column, waves from the east.
  const grid: GridForecast = {
    spec,
    fields: {
      windSpeed: field(4, 8, 4, 8),
      waveHeight: field(1, 1, 2, 2),
      wavePeriod: field(6, 6, 6, 6),
      swellHeight: field(0.5, 0.5, 0.5, 0.5),
      swellPeriod: field(12, 14, 12, 14),
    },
    vectors: {
      wind: toVectorField(field(6, 6, 6, 6), field(350, 10, 350, 10)),
      waves: toVectorField(field(6, 6, 6, 6), field(90, 90, 90, 90)),
      swell: toVectorField(field(12, 14, 12, 14), field(315, 315, 315, 315)),
    },
  };

  it('interpolates every field at the point', () => {
    const sample = samplePoint(grid, 0, 21.25, -157.75);
    expect(sample).toEqual({
      windSpeed: 6,
      windDirection: expect.any(Number),
      waveHeight: 1.5,
      wavePeriod: 6,
      waveDirection: expect.closeTo(90, 3),
      swellHeight: 0.5,
      swellPeriod: 13,
      swellDirection: expect.closeTo(315, 3),
    });
  });

  it('blends directions through north instead of through south', () => {
    const direction = samplePoint(grid, 0, 21.25, -157.75)?.windDirection ?? NaN;
    expect(Math.min(direction, 360 - direction)).toBeCloseTo(0, 3);
  });

  it('samples the edge for points just outside the grid', () => {
    const justOutside = 21 - MAX_CELLS_OUTSIDE * spec.step + 0.01;
    expect(samplePoint(grid, 0, justOutside, -158)?.waveHeight).toBe(1);
  });

  it('has no forecast more than half a cell outside the grid', () => {
    expect(samplePoint(grid, 0, 20.7, -158)).toBeNull();
    expect(samplePoint(grid, 0, 21.25, -157)).toBeNull();
  });
});
