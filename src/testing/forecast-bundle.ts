import { toVectorField } from '../app/domain/grid/vector-field';
import type { ForecastBundle, GridSpec } from '../app/domain/models';
import { hourlyTimes } from './open-meteo-builders';
import { buildSpotForecast } from './spot-forecast';

/** A small but complete forecast: two grid cells and one spot, with non-round float values. */
export function testForecastBundle(hourCount = 3, start = 1_800_000_000): ForecastBundle {
  const spec: GridSpec = { lat0: 21, lon0: -158, step: 0.125, rows: 1, cols: 2 };
  const field = (seed: number): Float32Array =>
    Float32Array.from({ length: hourCount * spec.cols }, (_, k) => seed + k * 0.1);
  return {
    times: hourlyTimes(start, hourCount),
    isDay: Array.from({ length: hourCount }, (_, hour) => hour % 2 === 0),
    grid: {
      spec,
      fields: {
        windSpeed: field(5),
        waveHeight: field(1.2),
        wavePeriod: field(8),
        swellHeight: field(0.9),
        swellPeriod: field(13),
      },
      vectors: {
        wind: toVectorField(field(5), field(70)),
        waves: toVectorField(field(8), field(180)),
        swell: toVectorField(field(13), field(200)),
      },
    },
    spots: buildSpotForecast(1, hourCount, (variable, _spot, hour) =>
      variable === 'windGust' ? null : hour + 0.3,
    ),
  };
}
