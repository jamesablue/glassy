import { toVectorField } from '../app/domain/grid/vector-field';
import type { ForecastBundle, GridSpec } from '../app/domain/models';
import fixture from './fixtures/spot-forecast.fixture.json';
import { hourlyTimes } from './open-meteo-builders';
import { buildSpotForecast, spotForecastFromFixture } from './spot-forecast';

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

/** 8:30 AM on the recorded forecast's first day (Sunday 18 October 2026) in Honolulu. */
export const RECORDED_MORNING = Date.UTC(2026, 9, 18, 18, 30);
/** The forecast hour that contains {@link RECORDED_MORNING}. */
export const RECORDED_MORNING_HOUR = 8;

/**
 * The recorded forecast for every Oahu spot (`fixtures/spot-forecast.fixture.json`, 48 hours from
 * midnight on 18 October 2026 in Honolulu), on a small synthetic grid. Its scores and rankings are
 * the golden ones in `fixtures/spot-forecast.expected.json`.
 */
export function recordedForecastBundle(): ForecastBundle {
  const spots = spotForecastFromFixture(fixture);
  return {
    times: fixture.times,
    // Like the data layer, take daylight from the first spot.
    isDay: fixture.times.map((_, hour) => fixture.series.isDay[0]?.[hour] === 1),
    grid: testForecastBundle(spots.hourCount, fixture.times[0]).grid,
    spots,
  };
}
