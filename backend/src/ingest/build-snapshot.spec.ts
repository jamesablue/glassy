import {
  catalogFingerprint,
  decodeSeries,
  OPEN_METEO_SOURCE,
  parseSnapshot,
  SNAPSHOT_FORMAT_VERSION,
  type EncodedSeries,
  type GridSpec,
} from '@glassy/shared';
import {
  codedResponse,
  hourlyTimes,
  openMeteoLocation,
  testSpot,
  valueCode,
} from '../testing/builders';
import type { OpenMeteoForecastResponses } from '../open-meteo/types';
import {
  GRID_MARINE_VARS,
  GRID_WIND_VARS,
  SPOT_MARINE_VARS,
  SPOT_WEATHER_VARS,
} from '../open-meteo/urls';
import { buildSnapshot, sharedHours } from './build-snapshot';

describe('buildSnapshot', () => {
  const grid: GridSpec = { lat0: 21, lon0: -158, step: 0.5, rows: 1, cols: 3 };
  const spots = [testSpot({ id: 'a' }), testSpot({ id: 'b', facing: 300 })];
  const fetchedAt = new Date('2027-01-15T08:00:00Z');
  const target = { spots, grid, fetchedAt };
  const start = 1_800_000_000;
  const times = hourlyTimes(start, 4);

  /** A series back in hour-major order, `NaN` where missing. */
  function hourly(series: EncodedSeries, locationCount: number): number[] {
    return Array.from(decodeSeries(series, locationCount));
  }

  function responses(
    overrides: Partial<OpenMeteoForecastResponses> = {},
  ): OpenMeteoForecastResponses {
    return {
      gridMarine: codedResponse(GRID_MARINE_VARS, 3, times),
      gridWind: codedResponse(GRID_WIND_VARS, 3, times),
      spotMarine: codedResponse(SPOT_MARINE_VARS, 2, times),
      spotWeather: codedResponse(SPOT_WEATHER_VARS, 2, times),
      ...overrides,
    };
  }

  it('writes the header the app checks', () => {
    const snapshot = buildSnapshot(responses(), target);
    expect(snapshot).toMatchObject({
      formatVersion: SNAPSHOT_FORMAT_VERSION,
      fetchedAt: '2027-01-15T08:00:00.000Z',
      source: OPEN_METEO_SOURCE,
      catalogFingerprint: catalogFingerprint(spots),
      times,
      spots: { ids: ['a', 'b'] },
      grid: { spec: grid },
    });
    expect(parseSnapshot(JSON.parse(JSON.stringify(snapshot)), { spots, grid })).toEqual(snapshot);
  });

  it('stores each spot series in catalog order, under its domain name', () => {
    const { series } = buildSnapshot(responses(), target).spots;
    const seaLevel = SPOT_MARINE_VARS.indexOf('sea_level_height_msl');
    const gusts = SPOT_WEATHER_VARS.indexOf('wind_gusts_10m');
    // decoded index = hour * spotCount + spot
    expect(hourly(series.seaLevel, 2)[2 * 2 + 1]).toBe(valueCode(seaLevel, 1, 2));
    expect(hourly(series.windGust, 2)[3 * 2 + 0]).toBe(valueCode(gusts, 0, 3));
    expect(series.isDay.deltas).toHaveLength(times.length * spots.length);
  });

  it('stores each grid field in field order', () => {
    const { fields } = buildSnapshot(responses(), target).grid;
    const swellPeriod = GRID_MARINE_VARS.indexOf('swell_wave_period');
    const windDirection = GRID_WIND_VARS.indexOf('wind_direction_10m');
    expect(hourly(fields.swellPeriod, 3)[1 * 3 + 2]).toBe(valueCode(swellPeriod, 2, 1));
    expect(hourly(fields.windDirection, 3)[0 * 3 + 1]).toBe(valueCode(windDirection, 1, 0));
  });

  it('stores each location as a run of hourly changes, with the decimals Open-Meteo sends', () => {
    const { spots: spotSeries, grid: gridSeries } = buildSnapshot(
      responses({
        spotMarine: [
          openMeteoLocation({ time: times, sea_level_height_msl: [0.42, 0.45, 0.45, null] }),
          openMeteoLocation({ time: times, sea_level_height_msl: [-0.1, -0.12, -0.15, -0.1] }, 1),
        ],
      }),
      target,
    );
    expect(spotSeries.series.seaLevel).toEqual({
      decimals: 2,
      deltas: [42, 3, 0, null, -10, -2, -3, 5],
    });
    expect(spotSeries.series.isDay.decimals).toBe(0);
    expect(gridSeries.fields.windSpeed.decimals).toBe(2);
    expect(gridSeries.fields.windDirection.decimals).toBe(0);
  });

  it('cuts every series to the hours all four responses share', () => {
    const later = hourlyTimes(start + 3600, 4);
    const snapshot = buildSnapshot(
      responses({ spotWeather: codedResponse(SPOT_WEATHER_VARS, 2, later) }),
      target,
    );
    expect(snapshot.times).toEqual(times.slice(1));
    const height = SPOT_MARINE_VARS.indexOf('swell_wave_height');
    // The first shared hour is the marine response's second hour.
    expect(hourly(snapshot.spots.series.swellHeight, 2)[0]).toBe(valueCode(height, 0, 1));
    expect(hourly(snapshot.spots.series.windSpeed, 2)[0]).toBe(valueCode(0, 0, 0));
    expect(snapshot.grid.fields.waveHeight.deltas).toHaveLength(3 * 3);
  });

  it('stores null for missing values and variables', () => {
    const [first, second] = codedResponse(SPOT_WEATHER_VARS, 2, times);
    const gappy = { ...first!.hourly, wind_gusts_10m: [null, 1, 2, 3] };
    const withoutDaylight = { ...second!.hourly };
    delete withoutDaylight.is_day;
    const snapshot = buildSnapshot(
      responses({
        spotWeather: [openMeteoLocation(gappy), openMeteoLocation(withoutDaylight, 1)],
      }),
      target,
    );
    expect(snapshot.spots.series.windGust.deltas[0]).toBeNull();
    expect(hourly(snapshot.spots.series.windGust, 2).slice(0, 2)).toEqual([
      NaN,
      valueCode(2, 1, 0),
    ]);
    // The second spot's run is its four hours, all missing.
    expect(snapshot.spots.series.isDay.deltas.slice(4)).toEqual([null, null, null, null]);
  });

  it('accepts the bare object Open-Meteo sends for a single location', () => {
    const one = [testSpot()];
    const [location] = codedResponse(SPOT_MARINE_VARS, 1, times);
    const [weather] = codedResponse(SPOT_WEATHER_VARS, 1, times);
    const snapshot = buildSnapshot(responses({ spotMarine: location!, spotWeather: weather! }), {
      ...target,
      spots: one,
    });
    expect(snapshot.spots.series.swellHeight.deltas).toHaveLength(times.length);
  });

  it.each([
    [
      'grid marine',
      { gridMarine: codedResponse(GRID_MARINE_VARS, 2, times) },
      'has 2 locations instead of 3',
    ],
    [
      'spot weather',
      { spotWeather: codedResponse(SPOT_WEATHER_VARS, 3, times) },
      'has 3 locations instead of 2',
    ],
  ])('refuses a %s response for another number of points', (label, override, message) => {
    expect(() => buildSnapshot(responses(override), target)).toThrow(
      `The ${label} response ${message}`,
    );
  });

  it('refuses a response whose locations are on different hours', () => {
    const [a] = codedResponse(GRID_WIND_VARS, 1, times);
    const [b, c] = codedResponse(GRID_WIND_VARS, 2, hourlyTimes(start + 3600, 4));
    expect(() => buildSnapshot(responses({ gridWind: [a!, b!, c!] }), target)).toThrow(
      'The grid wind response has locations on different hours',
    );
  });
});

describe('sharedHours', () => {
  it('runs from the latest start to the earliest end', () => {
    expect(
      sharedHours([
        [0, 3600, 7200, 10800],
        [3600, 7200, 10800, 14400],
      ]),
    ).toEqual({
      start: 3600,
      hourCount: 3,
    });
  });

  it.each([
    [[[], [0]]],
    [
      [
        [0, 3600],
        [7200, 10800],
      ],
    ],
  ])('fails when the axes share no hours: %j', (axes) => {
    expect(() => sharedHours(axes)).toThrow('The forecast responses have no hours in common');
  });
});
